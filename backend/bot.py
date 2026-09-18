"""
AegisMeet: Intake Agent (Headless Playwright Caption Scraper)
============================================================
Automated browser bot that:
1. Joins Google Meet calls with microphone & camera disabled.
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
import subprocess
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


def cleanup_profile_locks(profile_dir: str):
    """Removes stale Chromium SingletonLock files to prevent profile lock crashes."""
    for lock_name in ("SingletonLock", "SingletonSocket", "SingletonCookie"):
        lock_path = os.path.join(profile_dir, lock_name)
        if os.path.exists(lock_path) or os.path.islink(lock_path):
            try:
                os.unlink(lock_path)
            except Exception:
                pass


def get_native_chrome_path() -> Optional[str]:
    """Returns the path to native Google Chrome on macOS or Linux."""
    mac_chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if os.path.exists(mac_chrome):
        return mac_chrome
    linux_chrome = "/usr/bin/google-chrome"
    if os.path.exists(linux_chrome):
        return linux_chrome
    return None


class AegisMeetBot:
    def __init__(
        self,
        meeting_url: Optional[str] = None,
        bot_name: str = "AegisMeet Notetaker",
        proxy_url: str = DEFAULT_PROXY_URL,
        headless: bool = False,
        cdp_port: int = 9222,
    ):
        self.meeting_url = meeting_url
        self.bot_name = bot_name
        self.proxy_url = proxy_url.rstrip("/")
        self.headless = headless
        self.cdp_port = cdp_port
        self.chrome_proc: Optional[subprocess.Popen] = None
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
        Launches Google Chrome (via CDP for 100% native macOS Keychain & cookies),
        enters the lobby, handles name & media toggles, clicks Ask to Join,
        enables Closed Captions, and streams captions in real time.
        """
        if not self.meeting_url:
            raise ValueError("Meeting URL must be provided to join a live meeting.")

        profile_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".bot_profile")
        os.makedirs(profile_dir, exist_ok=True)
        cleanup_profile_locks(profile_dir)

        chrome_bin = get_native_chrome_path()
        use_cdp = chrome_bin is not None

        try:
            async with async_playwright() as p:
                if use_cdp:
                    # Launch native Chrome with CDP port
                    # Using native Chrome preserves the real macOS Keychain so signed-in Google sessions persist
                    logger.info(f"Launching native Google Chrome on CDP port {self.cdp_port}...")
                    chrome_args = [
                        chrome_bin,
                        f"--remote-debugging-port={self.cdp_port}",
                        f"--user-data-dir={profile_dir}",
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--use-fake-ui-for-media-stream",
                        "--use-fake-device-for-media-stream",
                        "--lang=en-US",
                        "--accept-lang=en-US,en;q=0.9",
                    ]
                    if self.headless:
                        chrome_args.append("--headless=new")
                    chrome_args.append("about:blank")

                    self.chrome_proc = subprocess.Popen(
                        chrome_args,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )

                    # Poll for CDP readiness
                    cdp_ready = False
                    for _ in range(20):
                        try:
                            async with httpx.AsyncClient() as client:
                                r = await client.get(f"http://127.0.0.1:{self.cdp_port}/json/version", timeout=1.0)
                                if r.status_code == 200:
                                    cdp_ready = True
                                    break
                        except Exception:
                            await asyncio.sleep(0.4)

                    if not cdp_ready:
                        raise RuntimeError(f"Native Chrome failed to respond on CDP port {self.cdp_port}")

                    self.browser = await p.chromium.connect_over_cdp(f"http://127.0.0.1:{self.cdp_port}")
                    self.context = self.browser.contexts[0]
                    self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()
                    logger.info("Connected to native Google Chrome via CDP.")
                else:
                    # Fallback for Linux CI / environments without native Chrome
                    logger.info("Native Chrome binary not found; launching Playwright Chromium.")
                    browser_args = [
                        "--use-fake-ui-for-media-stream",
                        "--use-fake-device-for-media-stream",
                        "--disable-blink-features=AutomationControlled",
                        "--lang=en-US",
                    ]
                    self.context = await p.chromium.launch_persistent_context(
                        user_data_dir=profile_dir,
                        headless=self.headless,
                        args=browser_args,
                        permissions=["microphone", "camera"],
                        locale="en-US",
                    )
                    self.page = self.context.pages[0] if self.context.pages else await self.context.new_page()

                # Anti-detection script
                await self.page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                """)

                logger.info(f"Navigating to {self.meeting_url}...")
                await self.page.goto(self.meeting_url, wait_until="domcontentloaded", timeout=60000)
                await asyncio.sleep(3)

                # Step 1: Dismiss informational popups & permission warnings
                dismiss_selectors = [
                    'button:has-text("Got it")',
                    'button:has-text("Begrepen")',
                    'button:has-text("Continue without microphone and camera")',
                    'button:has-text("Doorgaan zonder microfoon en camera")',
                    'button:has-text("Dismiss")',
                    'button:has-text("Sluiten")',
                    'button[aria-label="Dismiss"]',
                ]
                for sel in dismiss_selectors:
                    try:
                        btn = self.page.locator(sel)
                        if await btn.count() > 0 and await btn.first.is_visible():
                            await btn.first.click()
                            logger.info(f"Dismissed modal ({sel})")
                            await asyncio.sleep(0.5)
                    except Exception:
                        pass

                # Step 2: Handle Name Input (when joining as guest)
                try:
                    name_input = self.page.locator(
                        'input[placeholder*="name" i], input[aria-label*="name" i], input[type="text"]'
                    )
                    if await name_input.count() > 0 and await name_input.first.is_visible():
                        logger.info(f"Setting bot display name: '{self.bot_name}'")
                        await name_input.first.click()
                        await name_input.first.fill(self.bot_name)
                        await asyncio.sleep(0.5)
                except Exception as e:
                    logger.debug(f"Name input step passed: {e}")

                # Step 3: Mute Microphone & Turn Off Camera
                try:
                    mic_btn = self.page.locator(
                        'button[aria-label*="turn off microphone" i], button[aria-label*="microfoon uitschakelen" i], div[data-is-muted="false"]'
                    )
                    if await mic_btn.count() > 0 and await mic_btn.first.is_visible():
                        await mic_btn.first.click()
                        logger.info("Microphone muted.")
                except Exception:
                    pass

                try:
                    cam_btn = self.page.locator(
                        'button[aria-label*="turn off camera" i], button[aria-label*="camera uitschakelen" i]'
                    )
                    if await cam_btn.count() > 0 and await cam_btn.first.is_visible():
                        await cam_btn.first.click()
                        logger.info("Camera turned off.")
                except Exception:
                    pass

                await asyncio.sleep(1)

                # Step 4: Click 'Ask to join' or 'Join now'
                logger.info("Attempting to join meeting call...")
                join_selectors = [
                    'button:has-text("Ask to join")',
                    'button:has-text("Join now")',
                    'button:has-text("Join")',
                    'button:has-text("Vragen om deel te nemen")',
                    'button:has-text("Nu deelnemen")',
                    'button[jsname="Qx7uuf"]',
                    'button[jsname="jff5ce"]',
                ]
                joined = False
                for sel in join_selectors:
                    btn = self.page.locator(sel)
                    if await btn.count() > 0 and await btn.first.is_visible() and await btn.first.is_enabled():
                        await btn.first.click()
                        joined = True
                        logger.info(f"Clicked join button ({sel})")
                        break

                if not joined:
                    # In mock-meet or custom lobbies, try keyboard enter
                    logger.info("No active button selector found; pressing Enter.")
                    await self.page.keyboard.press("Enter")

                # Step 5: Check if Google Meet rejected guest knock
                await asyncio.sleep(3)
                try:
                    body_text = await self.page.inner_text("body")
                    is_restricted = (
                        "You can't join this video call" in body_text
                        or "Je kunt niet deelnemen" in body_text
                        or "Your meeting is safe" in body_text
                    )
                    if is_restricted:
                        logger.error(
                            "\n" + "=" * 80 + "\n"
                            "🚨 [GOOGLE MEET ACCESS RESTRICTION DETECTED]\n"
                            "Google Meet returned: \"You can't join this video call\"\n"
                            "Root Cause: Host Controls in Google Meet are set to 'Trusted', blocking unauthenticated guest bots.\n\n"
                            "👉 1-CLICK FIX: In your Google Meet call window, click the blue shield icon at bottom right (Host controls)\n"
                            "   and switch Meeting access to 'Open' (or toggle Host management OFF).\n"
                            "   Then click Join in AegisMeet!\n"
                            "=" * 80 + "\n"
                        )
                        await self.send_intake_chunk(
                            "System Notice",
                            "Google Meet Host Controls blocked guest bot. In your Google Meet tab, click the blue shield icon at bottom right (Host controls) and set Meeting Access to 'Open' to allow the bot to enter."
                        )
                        return None
                except Exception as e:
                    logger.debug(f"Restriction check error: {e}")

                # Step 6: Wait for meeting host to admit the bot
                logger.info("Waiting for host to admit bot into Google Meet call...")
                in_call_sel = (
                    'button[aria-label*="Turn on captions" i], '
                    'button[aria-label*="Turn off captions" i], '
                    'button[aria-label*="captions" i], '
                    'button[aria-label*="Leave call" i]'
                )
                admitted = False
                for _ in range(120):  # Wait up to 2 minutes
                    try:
                        in_call = self.page.locator(in_call_sel)
                        if await in_call.count() > 0 and await in_call.first.is_visible():
                            admitted = True
                            logger.info("Bot admitted into Google Meet call by host!")
                            break
                        body_now = await self.page.inner_text("body")
                        if "You can't join this video call" in body_now:
                            logger.warning("Access denied or session rejected.")
                            break
                    except Exception:
                        pass
                    await asyncio.sleep(1)

                if not admitted:
                    logger.warning("Host admission wait finished or call not yet admitted.")

                # Step 7: Enable Closed Captions
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
                    try:
                        btn = self.page.locator(selector)
                        if await btn.count() > 0 and await btn.first.is_visible():
                            await btn.first.click()
                            caption_button_clicked = True
                            logger.info(f"Clicked caption toggle button ({selector}).")
                            break
                    except Exception:
                        pass

                if not caption_button_clicked:
                    await self.page.keyboard.press("c")
                    logger.info("Sent keyboard shortcut 'c' to enable captions.")

                # Step 8: Stream captions via DOM MutationObserver & DOM polling
                logger.info(f"Listening for captions (monitoring up to {max_duration_sec}s)...")
                self._is_running = True
                start_time = time.time()
                seen_texts = set()

                try:
                    async def handle_browser_caption(speaker: str, text: str):
                        clean = text.strip()
                        if clean and clean not in seen_texts:
                            seen_texts.add(clean)
                            await self.send_intake_chunk(speaker, clean)

                    await self.page.expose_function("aegisMutationBridge", handle_browser_caption)

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

                # Finalize
                logger.info("Meeting monitoring completed.")
                await self.trigger_final_processing()
                if self.context:
                    await self.context.close()
                elif self.browser:
                    await self.browser.close()

        finally:
            # Terminate native Chrome process if spawned
            if self.chrome_proc:
                try:
                    self.chrome_proc.terminate()
                    self.chrome_proc.wait(timeout=3)
                except Exception:
                    self.chrome_proc.kill()
                self.chrome_proc = None
            cleanup_profile_locks(profile_dir)


def login_flow():
    """Opens a native Chrome window for one-time Google Account sign-in."""
    profile_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".bot_profile")
    os.makedirs(profile_dir, exist_ok=True)
    cleanup_profile_locks(profile_dir)

    chrome_bin = get_native_chrome_path()
    if not chrome_bin:
        print("Google Chrome not found at standard paths. Please install Google Chrome.")
        return

    print("\n" + "=" * 80)
    print("🌐 [OPENING GOOGLE CHROME FOR ONE-TIME SIGN-IN]")
    print("A Google Chrome window is opening on your desktop.")
    print("1. Sign into your Google account in that window.")
    print("2. Once signed in, simply CLOSE the Chrome window.")
    print("Your authenticated session will be saved for the bot.")
    print("=" * 80 + "\n")

    try:
        subprocess.run([
            chrome_bin,
            f"--user-data-dir={profile_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "--lang=en-US",
            "https://accounts.google.com/signin",
        ])
        cleanup_profile_locks(profile_dir)
        print("✅ Google session successfully saved to .bot_profile!")
    except Exception as e:
        print(f"Failed to open Google Chrome: {e}")


async def run_live_bot(
    meet_url: str,
    duration_sec: int = 180,
    bot_name: str = "AegisMeet Notetaker",
    proxy_url: str = DEFAULT_PROXY_URL,
    headless: bool = False,
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
    parser.add_argument("--headless", action="store_true", default=False, help="Run browser in headless mode")
    parser.add_argument("--headful", action="store_true", default=False, help="Run browser in visible mode")
    parser.add_argument("--simulate", action="store_true", help="Run simulated speech caption stream")
    parser.add_argument("--login", action="store_true", help="Open visible browser to sign into Google account once")
    parser.add_argument("--duration", type=int, default=120, help="Maximum call duration in seconds")

    args = parser.parse_args()

    if args.login:
        login_flow()
        return

    is_headless = args.headless and not args.headful

    bot = AegisMeetBot(
        meeting_url=args.url,
        bot_name=args.name,
        proxy_url=args.proxy_url,
        headless=is_headless,
    )

    if args.simulate or not args.url:
        logger.info("No meeting URL provided or --simulate specified. Running in simulation mode.")
        await bot.run_simulation()
    else:
        await bot.join_google_meet(max_duration_sec=args.duration)


if __name__ == "__main__":
    asyncio.run(main())
