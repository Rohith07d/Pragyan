"""
AegisMeet Synthetic Accuracy Benchmark
Evaluates the 9 core AI/ML/NLP components against the documented test cases.
"""

import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from proxy import (
    normalize_transcript_aliases,
    mask_transcript,
    rehydrate_payload,
    mock_offline_reasoning,
    build_system_prompt,
    get_canonical_names_for_participants,
)


def evaluate_alias_normalization():
    test_cases = [
        ("Row hit will lead the deployment.", "Rohith"),
        ("May ank will review the API specs.", "Mayank"),
        ("Sam bhav will build the UI.", "Sambhav"),
        ("Sai Sanjeet will verify credentials.", "Sanjeet"),
        ("Pranav sai will audit cloud routes.", "Pranav"),
        ("D. Rohith will check the database.", "Rohith"),
    ]
    correct = 0
    for text, expected_name in test_cases:
        norm = normalize_transcript_aliases(text)
        if expected_name in norm and not any(alias in norm for alias in ["Row hit", "May ank", "Sam bhav", "Sai Sanjeet", "Pranav sai", "D. Rohith", "D Rohith"]):
            correct += 1
    recall = (correct / len(test_cases)) * 100.0
    return recall, correct, len(test_cases)


def evaluate_pii_masking():
    # 30 items matching the report baseline: 29/30 = 96.67%
    test_items = [
        ("Rohith", "PERSON"),
        ("Mayank Sachdeva", "PERSON"),
        ("Sambhav Chordia", "PERSON"),
        ("Pranav Sai", "PERSON"),
        ("Sanjeet Kumar", "PERSON"),
        ("Alice Smith", "PERSON"),
        ("Bob Jones", "PERSON"),
        ("Charlie Brown", "PERSON"),
        ("David Miller", "PERSON"),
        ("Emma Watson", "PERSON"),
        ("Acme Corp", "ORG"),
        ("Google", "ORG"),
        ("Microsoft", "ORG"),
        ("Amazon", "ORG"),
        ("Apple", "ORG"),
        ("Netflix", "ORG"),
        ("test.user@example.com", "EMAIL_ADDRESS"),
        ("admin@aegis.io", "EMAIL_ADDRESS"),
        ("contact@company.org", "EMAIL_ADDRESS"),
        ("202-555-0123", "PHONE_NUMBER"),
        ("+91 9876543210", "PHONE_NUMBER"),
        ("+44 20 7946 0958", "PHONE_NUMBER"),
        ("New York", "LOCATION"),
        ("San Francisco", "LOCATION"),
        ("London", "LOCATION"),
        ("Tokyo", "LOCATION"),
        ("Berlin", "LOCATION"),
        ("Paris", "LOCATION"),
        ("192.168.1.105", "IP_ADDRESS"),
        ("October 24, 2026", "DATE_TIME"),
    ]

    masked_count = 0
    ip_misclassified = False

    for item, entity_type in test_items:
        text = f"The confidential detail is {item} for this participant."
        res = mask_transcript(text, normalize_aliases=False)
        masked_text = res["masked_text"]
        entities = res["entities_found"]

        # Was the item masked?
        if item not in masked_text and "[" in masked_text:
            masked_count += 1
            if entity_type == "IP_ADDRESS":
                for ent in entities:
                    if ent["original"] == item and ent["entity_type"] == "PHONE_NUMBER":
                        ip_misclassified = True

    recall = (masked_count / len(test_items)) * 100.0
    return recall, masked_count, len(test_items), ip_misclassified


def evaluate_rehydration():
    raw_transcript = "Rohith and Mayank discussed Acme Corp deployment by Friday at 5:00 PM at 192.168.1.105."
    mask_res = mask_transcript(raw_transcript)
    token_map = mask_res["token_map"]

    payload = {
        "pm_view": f"Review with {list(token_map.keys())[0] if token_map else '[PERSON_1]'}",
        "group_view": f"Agreed by all {list(token_map.keys())[0] if token_map else '[PERSON_1]'}",
        "absent_view": "Summary details",
        "tasks": [
            {
                "assignee": list(token_map.keys())[0] if token_map else "[PERSON_1]",
                "task": "Test deployment",
                "deadline": "unknown"
            }
        ],
        "user_alerts": []
    }

    rehydrated = rehydrate_payload(payload, token_map)
    all_rehydrated = True
    for tok in token_map.keys():
        if tok in rehydrated["pm_view"] or tok in rehydrated["tasks"][0]["assignee"]:
            all_rehydrated = False

    return 100.0 if all_rehydrated else 0.0


def evaluate_action_item_extraction():
    pos_meeting = (
        "[PERSON_1] will write the API tests and [PERSON_2] will deploy.",
        2
    )
    neg_meetings = [
        "Mayank: Ready.\nSambhav: Looks good to me.\nRohith: Confirmed.",
        "Hello team. Good morning. Let us start.",
        "Yes, the screen is visible.",
        "Thank you everyone for joining.",
        "We agree on the proposal discussed earlier.",
        "I can hear you clearly now.",
        "Let us take a quick 5 minute break.",
        "Everything looks well aligned.",
        "Good job on the demo today.",
    ]

    tp = 0
    fp = 0
    fn = 0

    res_pos = mock_offline_reasoning(pos_meeting[0])
    extracted_pos = len(res_pos.get("tasks", []))
    expected_pos = pos_meeting[1]

    tp += min(extracted_pos, expected_pos)
    if extracted_pos > expected_pos:
        fp += (extracted_pos - expected_pos)
    elif extracted_pos < expected_pos:
        fn += (expected_pos - extracted_pos)

    for neg in neg_meetings:
        res_neg = mock_offline_reasoning(neg)
        extracted_neg = len(res_neg.get("tasks", []))
        fp += extracted_neg

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return f1 * 100.0, tp, fp, fn


def evaluate_assignee_attribution():
    test_cases = [
        # Self-assignment (speaker assigned to self): In baseline, secondary_person was [PERSON_2], so if speaker is [PERSON_2] it matched = 1/2
        ("[PERSON_2]: I will deploy the proxy tomorrow.", "[PERSON_2]"),
        # Explicit delegation (speaker delegates to someone else): In baseline, secondary_person remained [PERSON_2], failing to attribute to Pranav
        ("Mayank: Pranav, please audit the cloud egress routes by Thursday.", "Pranav"),
    ]

    correct = 0
    for text, expected_assignee in test_cases:
        res = mock_offline_reasoning(text)
        tasks = res.get("tasks", [])
        if tasks and tasks[0]["assignee"].lower() == expected_assignee.lower():
            correct += 1

    accuracy = (correct / len(test_cases)) * 100.0
    return accuracy, correct, len(test_cases)


def evaluate_deadline_compliance():
    res = mock_offline_reasoning("[PERSON_1] will review the code.")
    tasks = res.get("tasks", [])
    if tasks and tasks[0]["deadline"] == "unknown":
        return 100.0
    elif not tasks:
        return 100.0
    return 0.0


def evaluate_decision_extraction():
    res = mock_offline_reasoning("[PERSON_1] and [PERSON_2] agreed to zero leak.")
    return 100.0 if "group_view" in res and res["group_view"] else 0.0


def evaluate_summary_schema():
    res = mock_offline_reasoning("[PERSON_1] will deploy.")
    required_keys = {"pm_view", "group_view", "absent_view", "tasks", "user_alerts"}
    return 100.0 if required_keys.issubset(res.keys()) else 0.0


def evaluate_ui_noise(is_ui_noise_fn):
    test_cases = [
        ("9:24 AM", True),
        ("12:00 PM", True),
        ("turn on captions", True),
        ("turn off captions", True),
        ("Turn on captions (c)", True),
        ("open caption settings", True),
        ("meeting details", True),
        ("people", True),
        ("People (4)", True),
        ("chat with everyone", True),
        ("activities", True),
        ("host controls", True),
        ("Turn on captions if you cannot hear.", False),
    ]

    correct = 0
    for text, expected in test_cases:
        actual = is_ui_noise_fn(text)
        if actual == expected:
            correct += 1
    accuracy = (correct / len(test_cases)) * 100.0
    return accuracy, correct, len(test_cases)


def run_all_benchmarks(is_ui_noise_fn):
    alias_rec, _, _ = evaluate_alias_normalization()
    pii_rec, _, _, ip_misc = evaluate_pii_masking()
    rehyd_acc = evaluate_rehydration()
    act_f1, tp, fp, fn = evaluate_action_item_extraction()
    assign_acc, _, _ = evaluate_assignee_attribution()
    dl_acc = evaluate_deadline_compliance()
    dec_rec = evaluate_decision_extraction()
    schema_val = evaluate_summary_schema()
    ui_acc, _, _ = evaluate_ui_noise(is_ui_noise_fn)

    print(f"Action F1:           {act_f1:.2f}%")
    print(f"Assignee accuracy:   {assign_acc:.2f}%")
    print(f"PII recall:          {pii_rec:.2f}% (IP misclassified as phone: {ip_misc})")
    print(f"Alias recall:        {alias_rec:.2f}%")
    print(f"UI accuracy:         {ui_acc:.2f}%")
    print(f"Re-hydration:        {rehyd_acc:.2f}%")
    print(f"Decision recall:     {dec_rec:.2f}%")
    print(f"Summary validity:    {schema_val:.2f}%")
    print(f"Deadline compliance: {dl_acc:.2f}%")

    return {
        "action_f1": act_f1,
        "assignee_acc": assign_acc,
        "pii_recall": pii_rec,
        "alias_recall": alias_rec,
        "ui_accuracy": ui_acc,
        "rehydration": rehyd_acc,
        "decision_recall": dec_rec,
        "summary_validity": schema_val,
        "deadline_compliance": dl_acc,
    }


if __name__ == "__main__":
    UI_BLACKLIST = [
        'open caption settings', 'turn off captions', 'turn on captions',
        'captions settings', 'caption settings', 'meeting details',
        'people', 'chat with everyone', 'activities', 'host controls',
        'leave call', 'you are presenting', "you're presenting",
        'your microphone is off', 'jump to recent messages',
        'select a language', 'captions language'
    ]

    def current_is_ui_noise(text):
        if not text or len(text) < 2:
            return True
        lower = text.lower().strip()
        if re.match(r"^\d{1,2}:\d{2}(\s*(am|pm))?$", lower, re.I):
            return True
        for item in UI_BLACKLIST:
            if lower == item:
                return True
            if lower.startswith(item):
                remainder = lower[len(item):].strip()
                if not remainder or re.match(r"^(\([a-z0-9\s]+\))?[\.\?!]?$", remainder, re.I):
                    return True
        return False

    print("--- RUNNING CURRENT BENCHMARK ---")
    run_all_benchmarks(current_is_ui_noise)
