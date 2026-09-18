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
            browser_args = [
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
            ]

            self.browser = await p.chromium.launch(
                headless=self.headless,
                args=browser_args,
            )
            self.context = await self.browser.new_context(
                permissions=["microphone", "camera"],
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            self.page = await self.context.new_page()

            logger.info(f"Navigating to {self.meeting_url}...")
            await self.page.goto(self.meeting_url, wait_until="networkidle", timeout=60000)

            # Step 1: Handle Lobby (Dismiss initial permission popups)
            await asyncio.sleep(3)
            try:
                # Enter Name input if lobby requires it
                name_input = self.page.locator('input[type="text"], input[aria-label*="name" i]')
                if await name_input.count() > 0 and await name_input.first.is_visible():
                    logger.info(f"Setting bot name: '{self.bot_name}'")
                    await name_input.first.fill(self.bot_name)
                    await asyncio.sleep(1)
            except Exception as e:
                logger.debug(f"Name input handling passed: {e}")

            # Step 2: Mute mic & camera
            try:
                mic_button = self.page.locator('button[aria-label*="turn off microphone" i], div[data-is-muted="false"]')
                if await mic_button.count() > 0 and await mic_button.first.is_visible():
                    await mic_button.first.click()
                    logger.info("Microphone muted.")
            except Exception:
                pass

            try:
                cam_button = self.page.locator('button[aria-label*="turn off camera" i]')
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
                'span:has-text("Ask to join")',
                'span:has-text("Join now")',
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

            # Step 4: Enable Closed Captions
            logger.info("Waiting for call entry and turning on captions...")
            await asyncio.sleep(5)
            # Shortcut 'c' toggles captions on Google Meet
            await self.page.keyboard.press("c")
            logger.info("Sent shortcut 'c' to enable captions.")

            # Step 5: Monitor Caption DOM
            # Google Meet captions reside in containers with class 'a4bIc' or jsname 'YSxPtf'
            logger.info(f"Listening for captions (monitoring up to {max_duration_sec}s)...")
            self._is_running = True
            start_time = time.time()
            seen_texts = set()

            while self._is_running and (time.time() - start_time < max_duration_sec):
                try:
                    # Query common Google Meet caption elements
                    caption_elements = await self.page.query_selector_all(
                        'div[jsname="YSxPtf"], div.a4bIc, span.yg3OAc'
                    )
                    for el in caption_elements:
                        text = (await el.inner_text()).strip()
                        if text and text not in seen_texts:
                            seen_texts.add(text)
                            # Attempt to find speaker header
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
            await self.browser.close()


async def main():
    parser = argparse.ArgumentParser(description="AegisMeet Intake Agent (Playwright Bot)")
    parser.add_argument("--url", type=str, help="Google Meet URL to join")
    parser.add_argument("--name", type=str, default="AegisMeet Notetaker", help="Display name for the bot")
    parser.add_argument("--proxy-url", type=str, default=DEFAULT_PROXY_URL, help="URL of the local FastAPI proxy")
    parser.add_argument("--headless", action="store_true", default=True, help="Run browser in headless mode")
    parser.add_argument("--simulate", action="store_true", help="Run simulated speech caption stream")
    parser.add_argument("--duration", type=int, default=120, help="Maximum call duration in seconds")

    args = parser.parse_args()

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
