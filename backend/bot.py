"""
AegisMeet: Intake Agent (Headless Playwright Caption Scraper)
============================================================
Automated browser bot that:
1. Joins Google Meet calls headlessly with microphone & camera disabled.
2. Enters meeting lobby, sets custom display name, and requests join.
3. Automatically enables Closed Captions ('c').
4. Observes DOM mutation on caption containers to extract live speaker text.
5. Streams caption chunks in real-time to the local FastAPI proxy (/api/intake).
6. On session completion, triggers end-to-end zero-leak processing (/api/process).
7. Includes an automated simulation/mock mode for offline testing and evaluation.
"""

import os
import sys
import time
import json
import asyncio
import logging
import argparse
from typing import Optional, List, Dict
import httpx
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [AegisBot] %(message)s"
)
logger = logging.getLogger("aegismeet-bot")

# Default Target Endpoints
DEFAULT_PROXY_URL = os.getenv("PROXY_URL", "http://localhost:8000")

# Sample meeting script used for simulation / mock testing
SIMULATION_SCRIPT = [
    {"speaker": "Mayank Sachdeva", "text": "Good morning team. Today we are reviewing the AegisMeet zero-leak proxy architecture."},
    {"speaker": "Rohith", "text": "I have completed the FastAPI backend endpoints and Presidio masking integration with en_core_web_lg."},
    {"speaker": "Sambhav Chordia", "text": "Great. Acme Corp expressed security concerns about raw meeting notes reaching public LLMs."},
    {"speaker": "Mayank Sachdeva", "text": "Exactly. We must guarantee that zero personal names or company identities leave localhost."},
    {"speaker": "Sambhav Chordia", "text": "I will finalize the Next.js dual-pane dashboard by tomorrow at 5:00 PM."},
    {"speaker": "Mayank Sachdeva", "text": "Agreed. Rohith, please verify the webhook dispatch and SQLite task logging before next Friday."},
]


class AegisMeetBot:
    def __init__(
        self,
        meeting_url: Optional[str] = None,
        bot_name: str = "AegisMeet Notetaker",
        proxy_url: str = DEFAULT_PROXY_URL,
        headless: bool = True,
    ):
        self.meeting_url = meeting_url
        self.bot_name = bot_name
        self.proxy_url = proxy_url.rstrip("/")
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.collected_chunks: List[str] = []
        self._is_running = False

    async def send_intake_chunk(self, speaker: str, text: str):
        """Streams an extracted caption chunk to the local FastAPI proxy."""
        clean_text = text.strip()
        if not clean_text:
            return

        formatted = f"{speaker}: {clean_text}" if speaker else clean_text
        self.collected_chunks.append(formatted)
        logger.info(f"Captured Caption -> {formatted}")

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{self.proxy_url}/api/intake",
                    json={"speaker": speaker, "caption": clean_text},
                )
        except Exception as e:
            logger.debug(f"Proxy intake notification skipped ({e})")

    async def trigger_final_processing(self) -> Optional[Dict]:
        """Sends the accumulated transcript to the proxy's zero-leak pipeline."""
        full_transcript = "\n".join(self.collected_chunks).strip()
        if not full_transcript:
            logger.warning("No transcript captured to process.")
            return None

        logger.info(f"Finalizing session. Processing full transcript ({len(full_transcript)} chars)...")
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.proxy_url}/api/process",
                    json={"transcript": full_transcript},
                )
                resp.raise_for_status()
                res_data = resp.json()
                logger.info("Pipeline processing completed successfully!")
                return res_data
        except Exception as e:
            logger.error(f"Failed to trigger /api/process: {e}")
            return None

    async def run_simulation(self, delay: float = 1.5):
        """Simulates live streaming of meeting captions to the proxy."""
        logger.info("Running AegisMeet Intake Simulation...")
        for turn in SIMULATION_SCRIPT:
            await self.send_intake_chunk(turn["speaker"], turn["text"])
            await asyncio.sleep(delay)

        logger.info("Simulation complete. Triggering pipeline processing...")
        result = await self.trigger_final_processing()
        if result:
            logger.info("Task extraction & persona views generated:")
            logger.info(json.dumps(result.get("rehydrated_result", {}), indent=2))
        return result

    async def join_google_meet(self, max_duration_sec: int = 300):
        """
        Launches Playwright Chromium with media stream permissions bypassed,
        joins the Google Meet call, enables captions, and monitors caption DOM elements.
        """
        if not self.meeting_url:
            raise ValueError("Meeting URL must be provided to join a live meeting.")

        logger.info(f"Launching Playwright Chromium (headless={self.headless})...")
        async with async_playwright() as p:
            # Grant fake media streams to avoid browser mic/cam permission blocks
            # Browser Bypass: Auto-accept media streams and prevent automation detection
            # Browser Bypass: Auto-accept media streams, force en-US locale, and avoid automation flags
            browser_args = [
                "--use-fake-ui-for-media-stream",     # Auto-accepts permission prompts
                "--use-fake-device-for-media-stream", # Feeds a blank stream instead of webcam
                "--disable-blink-features=AutomationControlled", # Prevents bot detection
                "--lang=en-US",
            ]

            profile_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".bot_profile")
            os.makedirs(profile_dir, exist_ok=True)

            # Attempt to use local Google Chrome if available for maximum authenticity
            launch_kwargs = {
                "user_data_dir": profile_dir,
                "headless": self.headless,
                "args": browser_args,
                "permissions": ["microphone", "camera"],
                "locale": "en-US",
                "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            }

            try:
                self.context = await p.chromium.launch_persistent_context(channel="chrome", **launch_kwargs)
                logger.info("Launched using installed Google Chrome channel.")
            except Exception as chrome_err:
                logger.debug(f"Chrome channel unavailable ({chrome_err}); launching Chromium.")
                self.context = await p.chromium.launch_persistent_context(**launch_kwargs)

            self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()

            # Prevent automation detection
            await self.page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            """)

            logger.info(f"Navigating to {self.meeting_url}...")
            await self.page.goto(self.meeting_url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(4)

            # Check if Google Meet blocked unauthenticated guest entry
            try:
                body_text = await self.page.inner_text("body")
                is_blocked = (
                    "You can't join this video call" in body_text
                    or "Je kunt niet deelnemen" in body_text
                    or "No one can join a meeting unless invited" in body_text
                )
                if is_blocked:
                    logger.error(
                        "\n" + "=" * 80 + "\n"
                        "🚨 [GOOGLE MEET ACCESS RESTRICTION DETECTED]\n"
                        "Google Meet returned: \"You can't join this video call\"\n"
                        "Root Cause: Anonymous guest entry is blocked by Google Meet Host Controls (Trusted/Restricted mode).\n\n"
                        "3 WAYS TO RUN THE LIVE DEMO NOW:\n"
                        "Option 1 (Instant Zero-Setup): Open your active Meet tab in Chrome, press Cmd+Option+I (Console), and paste:\n"
                        "  (async()=>{const s=document.createElement('script');s.src='http://localhost:8000/aegis-meet.js';document.body.appendChild(s);})()\n"
                        "Option 2 (Host Controls): In your active Meet window, click Host Controls (blue shield icon, bottom right) -> change Meeting Access to 'Open'.\n"
                        "Option 3 (1-Time Sign-In): Run './backend/venv/bin/python backend/bot.py --login' to sign in once.\n"
                        + "=" * 80 + "\n"
                    )
                    await self.send_intake_chunk(
                        "System Notice",
                        "Google Meet blocked guest bot. Run In-Tab script via Console or set Host Controls Meeting Access to 'Open'."
                    )
                    await self.context.close()
                    return None
            except Exception as e:
                logger.debug(f"Block check error: {e}")

            # Dismiss common Google Meet camera/mic prompt modals
            try:
                dismiss_btn = self.page.locator(
                    'button:has-text("Continue without microphone and camera"), '
                    'button:has-text("Doorgaan zonder microfoon en camera"), '
                    'button:has-text("Dismiss"), button:has-text("Sluiten"), button[aria-label="Dismiss"]'
                )
                if await dismiss_btn.count() > 0 and await dismiss_btn.first.is_visible():
                    await dismiss_btn.first.click()
                    logger.info("Dismissed Google Meet permission dialog.")
                    await asyncio.sleep(1)
            except Exception:
                pass

            # Step 1: Handle Lobby (Enter Name if requested)
            try:
                name_input = self.page.locator('input[type="text"], input[aria-label*="name" i], input[placeholder*="name" i], input[jsname="YPqjbf"]')
                if await name_input.count() > 0 and await name_input.first.is_visible():
                    logger.info(f"Setting bot name: '{self.bot_name}'")
                    await name_input.first.fill(self.bot_name)
                    await asyncio.sleep(1)
            except Exception as e:
                logger.debug(f"Name input handling passed: {e}")

            # Step 2: Mute mic & camera
            try:
                mic_button = self.page.locator('button[aria-label*="turn off microphone" i], button[aria-label*="microfoon uitschakelen" i], div[data-is-muted="false"]')
                if await mic_button.count() > 0 and await mic_button.first.is_visible():
                    await mic_button.first.click()
                    logger.info("Microphone muted.")
            except Exception:
                pass

            try:
                cam_button = self.page.locator('button[aria-label*="turn off camera" i], button[aria-label*="camera uitschakelen" i]')
                if await cam_button.count() > 0 and await cam_button.first.is_visible():
                    await cam_button.first.click()
                    logger.info("Camera turned off.")
            except Exception:
                pass

            # Step 3: Click 'Ask to join' or 'Join now'
            logger.info("Attempting to join meeting call...")
            join_buttons = [
                'button:has-text("Ask to join")',
                'button:has-text("Join now")',
                'button:has-text("Join")',
                'button:has-text("Vragen om deel te nemen")',
                'button:has-text("Nu deelnemen")',
                'button[jsname="Qx7uuf"]',
                'button[jsname="jff5ce"]',
                'span:has-text("Ask to join")',
                'span:has-text("Join now")',
                'div[role="button"]:has-text("Ask to join")',
                'div[role="button"]:has-text("Join now")',
            ]
            joined = False
            for btn_selector in join_buttons:
                btn = self.page.locator(btn_selector)
                if await btn.count() > 0 and await btn.first.is_visible():
                    await btn.first.click()
                    joined = True
                    logger.info(f"Clicked join button ({btn_selector})")
                    break

            if not joined:
                logger.warning("Could not find direct join button; attempting keyboard Enter.")
                await self.page.keyboard.press("Enter")

            # Step 4: Wait to be admitted by the meeting host
            logger.info("Waiting for host to admit bot into Google Meet call...")
            try:
                await self.page.wait_for_selector(
                    'button[aria-label*="Turn on captions" i], button[aria-label*="Turn off captions" i], button[aria-label*="captions" i], button[aria-label*="Leave call" i]',
                    timeout=180000  # Wait up to 3 minutes for host to admit
                )
                logger.info("Bot admitted into the meeting by host!")
            except Exception as e:
                logger.warning(f"Host admission check proceeded: {e}")

            # Step 5: Automatically locate and click [aria-label="Turn on captions"] (CC) button
            logger.info("Locating and clicking captions toggle...")
            await asyncio.sleep(2)
            caption_button_clicked = False
            caption_selectors = [
                'button[aria-label="Turn on captions"]',
                'button[aria-label*="Turn on captions" i]',
                'button[aria-label*="captions" i]',
                'button[data-tooltip*="captions" i]',
            ]
            for selector in caption_selectors:
                btn = self.page.locator(selector)
                if await btn.count() > 0 and await btn.first.is_visible():
                    await btn.first.click()
                    caption_button_clicked = True
                    logger.info(f"Successfully clicked caption toggle button ({selector}).")
                    break

            if not caption_button_clicked:
                await self.page.keyboard.press("c")
                logger.info("Sent keyboard shortcut 'c' to enable captions.")

            # Step 6: Stream captions via DOM MutationObserver & DOM polling
            logger.info(f"Listening for captions (monitoring up to {max_duration_sec}s)...")
            self._is_running = True
            start_time = time.time()
            seen_texts = set()

            # Expose bridge to browser runtime for real-time MutationObserver
            try:
                async def handle_browser_caption(speaker: str, text: str):
                    clean = text.strip()
                    if clean and clean not in seen_texts:
                        seen_texts.add(clean)
                        await self.send_intake_chunk(speaker, clean)

                await self.page.expose_function("aegisMutationBridge", handle_browser_caption)

                # Attach DOM MutationObserver to stream caption nodes as they appear
                await self.page.evaluate("""() => {
                    const observer = new MutationObserver((mutations) => {
                        for (const m of mutations) {
                            for (const node of m.addedNodes) {
                                if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
                                    const txt = (node.textContent || "").trim();
                                    if (txt.length > 2) {
                                        let spk = "Participant";
                                        const parent = node.parentElement ? node.parentElement.closest('div[jscontroller="D1tHje"]') : null;
                                        if (parent) {
                                            const header = parent.querySelector('div.zs75Ib, div.jxFHg');
                                            if (header) spk = header.textContent.trim();
                                        }
                                        if (window.aegisMutationBridge) {
                                            window.aegisMutationBridge(spk, txt);
                                        }
                                    }
                                }
                            }
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
                }""")
                logger.info("DOM MutationObserver successfully registered for real-time caption scraping.")
            except Exception as e:
                logger.warning(f"Could not register MutationObserver ({e}); relying on polling observer.")

            while self._is_running and (time.time() - start_time < max_duration_sec):
                try:
                    # Query Google Meet caption elements
                    caption_elements = await self.page.query_selector_all(
                        'div[jsname="YSxPtf"], div.a4bIc, span.yg3OAc'
                    )
                    for el in caption_elements:
                        text = (await el.inner_text()).strip()
                        if text and text not in seen_texts:
                            seen_texts.add(text)
                            speaker = "Participant"
                            parent = await el.evaluate_handle("el => el.closest('div[jscontroller=\"D1tHje\"]') || el.parentElement")
                            if parent:
                                speaker_el = await parent.as_element().query_selector('div.zs75Ib, div.jxFHg')
                                if speaker_el:
                                    speaker = (await speaker_el.inner_text()).strip()

                            await self.send_intake_chunk(speaker, text)
                except Exception as e:
                    logger.debug(f"Caption polling interval: {e}")

                await asyncio.sleep(1.0)

            # Cleanup and trigger processing
            logger.info("Meeting monitoring completed.")
            await self.trigger_final_processing()
            if self.context:
                await self.context.close()
            elif self.browser:
                await self.browser.close()


async def login_flow():
    """Opens a visible Chromium window for one-time Google Account sign-in."""
    profile_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".bot_profile")
    os.makedirs(profile_dir, exist_ok=True)
    logger.info("Opening visible Chromium browser. Sign into your Google account...")
    async with async_playwright() as p:
        login_args = [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--disable-blink-features=AutomationControlled",
            "--lang=en-US",
        ]
        try:
            context = await p.chromium.launch_persistent_context(
                user_data_dir=profile_dir,
                headless=False,
                channel="chrome",
                args=login_args,
                permissions=["microphone", "camera"],
                locale="en-US",
            )
        except Exception:
            context = await p.chromium.launch_persistent_context(
                user_data_dir=profile_dir,
                headless=False,
                args=login_args,
                permissions=["microphone", "camera"],
                locale="en-US",
            )
        page = context.pages[0] if context.pages else await context.new_page()
        await page.goto("https://accounts.google.com/signin")
        logger.info("Browser open. Please sign in, then close the browser window.")
        try:
            while len(context.pages) > 0 and not page.is_closed():
                await asyncio.sleep(2)
        except Exception:
            pass
        logger.info("Login session successfully saved to .bot_profile!")


async def run_live_bot(
    meet_url: str,
    duration_sec: int = 180,
    bot_name: str = "AegisMeet Notetaker",
    proxy_url: str = DEFAULT_PROXY_URL,
    headless: bool = True,
) -> Optional[Dict]:
    """
    Entrypoint invoked by FastAPI proxy scheduler (APScheduler) or ad-hoc /join endpoint.
    """
    bot = AegisMeetBot(
        meeting_url=meet_url,
        bot_name=bot_name,
        proxy_url=proxy_url,
        headless=headless,
    )
    if not meet_url or meet_url.lower() in ("simulate", "mock", "test"):
        return await bot.run_simulation()
    return await bot.join_google_meet(max_duration_sec=duration_sec)


async def main():
    parser = argparse.ArgumentParser(description="AegisMeet Intake Agent (Playwright Bot)")
    parser.add_argument("--url", type=str, help="Google Meet URL to join")
    parser.add_argument("--name", type=str, default="AegisMeet Notetaker", help="Display name for the bot")
    parser.add_argument("--proxy-url", type=str, default=DEFAULT_PROXY_URL, help="URL of the local FastAPI proxy")
    parser.add_argument("--headless", action="store_true", default=True, help="Run browser in headless mode")
    parser.add_argument("--simulate", action="store_true", help="Run simulated speech caption stream")
    parser.add_argument("--login", action="store_true", help="Open visible browser to sign into Google account once")
    parser.add_argument("--duration", type=int, default=120, help="Maximum call duration in seconds")

    args = parser.parse_args()

    if args.login:
        await login_flow()
        return

    bot = AegisMeetBot(
        meeting_url=args.url,
        bot_name=args.name,
        proxy_url=args.proxy_url,
        headless=args.headless,
    )

    if args.simulate or not args.url:
        logger.info("No meeting URL provided or --simulate specified. Running in simulation mode.")
        await bot.run_simulation()
    else:
        await bot.join_google_meet(max_duration_sec=args.duration)


if __name__ == "__main__":
    asyncio.run(main())

