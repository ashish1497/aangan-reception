"""Selenium end-to-end tests for the Aangan Voice Desk dashboard.

Run:  python3 -m pip install selenium   (or: uv run --with selenium python test/e2e/test_dashboard.py)
      python3 test/e2e/test_dashboard.py            (starts its own dev server)
      BASE_URL=https://your-app.vercel.app python3 test/e2e/test_dashboard.py   (test a deployed copy)

Every element is found by data-testid, and the page sets data-ready="true" on <body>
when it finishes loading, so waits are explicit and there are no sleeps.
"""
import json
import os
import subprocess
import sys
import time
import unittest
import urllib.request

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORT = int(os.environ.get("E2E_PORT", "3777"))
BASE = os.environ.get("BASE_URL", f"http://127.0.0.1:{PORT}")
SERVER = None


def tid(name):
    return (By.CSS_SELECTOR, f'[data-testid="{name}"]')


def setUpModule():
    global SERVER
    if os.environ.get("BASE_URL"):
        return
    env = {k: v for k, v in os.environ.items() if not k.startswith(("UPSTASH", "TELEGRAM", "GOOGLE_GEMINI", "GEMINI", "WEBHOOK"))}
    env["PORT"] = str(PORT)
    SERVER = subprocess.Popen(["node", os.path.join(ROOT, "dev-server.js")], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE + "/", timeout=1)
            return
        except Exception:
            time.sleep(0.1)
    raise RuntimeError("dev server did not start")


def tearDownModule():
    if SERVER:
        SERVER.terminate()


class DashboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--window-size=1400,1000")
        opts.add_argument("--no-sandbox")
        cls.driver = webdriver.Chrome(options=opts)
        cls.wait = WebDriverWait(cls.driver, 15)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def open(self):
        self.driver.get(BASE + "/")
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'body[data-ready="true"]')))

    def ready(self):
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'body[data-ready="true"]')))

    def kpi(self, key):
        return self.driver.find_element(*tid(f"kpi-{key}-value")).text

    # 1
    def test_01_page_title_and_header(self):
        self.open()
        self.assertIn("Aangan Voice Desk", self.driver.find_element(*tid("app-title")).text)

    # 2
    def test_02_all_kpi_tiles_render(self):
        self.open()
        keys = ["calls", "within-5-min", "within-5-min-share", "qualified", "grey", "unqualified",
                "near-miss", "booked", "after-hours-share"]
        for k in keys:
            self.assertTrue(self.driver.find_element(*tid(f"kpi-{k}")).is_displayed(), k)
            self.assertNotEqual(self.kpi(k), "")

    # 3
    def test_03_empty_state_then_load_sample_calls(self):
        self.open()
        self.assertEqual(len(self.driver.find_elements(*tid("call-row"))), 0)
        self.assertIn("No calls yet", self.driver.find_element(*tid("call-rows")).text)
        self.driver.find_element(*tid("load-samples")).click()
        self.wait.until(lambda d: len(d.find_elements(*tid("call-row"))) == 8)
        self.assertIn("Sample call", self.driver.find_elements(*tid("call-row"))[0].text)
        self.assertEqual(self.kpi("calls"), "0")

    # 4
    def test_04_count_samples_toggle_changes_kpis(self):
        self.open()
        self.driver.find_element(*tid("toggle-count-demo")).click()
        self.wait.until(lambda d: d.find_element(*tid("kpi-calls-value")).text == "8")
        self.assertEqual(self.kpi("calls"), "8")
        total = sum(int(self.kpi(k)) for k in ("qualified", "grey", "unqualified"))
        self.assertEqual(total, 8)

    # 5
    def test_05_row_click_opens_detail_with_reasons_and_transcript(self):
        self.open()
        self.driver.find_element(*tid("toggle-show-demo")).click()
        self.wait.until(lambda d: len(d.find_elements(*tid("call-row"))) == 8)
        self.driver.find_elements(*tid("call-row"))[0].click()
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="call-detail"][data-loaded="true"]')))
        self.assertIn(self.driver.find_element(*tid("detail-qualification")).text.lower().split()[-1],
                      ("qualified", "grey", "unqualified"))
        self.assertTrue(self.driver.find_element(*tid("detail-brief")).text.strip())
        self.assertGreater(len(self.driver.find_elements(By.CSS_SELECTOR, '[data-testid="detail-reasons"] li')), 0)
        self.assertTrue(self.driver.find_element(*tid("detail-transcript")).text.strip())

    # 6
    def test_06_hiding_sample_calls_empties_the_table(self):
        self.open()
        self.driver.find_element(*tid("toggle-show-demo")).click()
        self.wait.until(lambda d: len(d.find_elements(*tid("call-row"))) == 8)
        self.driver.find_element(*tid("toggle-show-demo")).click()
        self.wait.until(lambda d: len(d.find_elements(*tid("call-row"))) == 0)
        self.assertIn("No calls yet", self.driver.find_element(*tid("call-rows")).text)

    # 7
    def test_07_cost_and_value_panel(self):
        self.open()
        panel = self.driver.find_element(*tid("cost-value")).text
        self.assertIn("Pipeline value if converted", panel)
        self.assertIn("Rs 8 to 14 lakh", panel)
        self.assertIn("Cost per call", panel)

    # 8
    def test_08_product_copy_has_no_build_notes(self):
        self.open()
        self.driver.find_element(*tid("load-samples")).click()
        self.wait.until(lambda d: len(d.find_elements(*tid("call-row"))) == 8)
        self.driver.find_elements(*tid("call-row"))[0].click()
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="call-detail"][data-loaded="true"]')))
        text = self.driver.find_element(By.TAG_NAME, "body").text.lower()
        for word in ("placeholder", "assumption", "demo data", "todo", "lorem", "replace with"):
            self.assertNotIn(word, text)

    # 9
    def test_09_new_webhook_call_shows_after_refresh(self):
        body = json.dumps({
            "callId": "e2e-1", "callerName": "Selenium Caller", "phone": "+910000000001",
            "startedAt": "2026-10-06T05:00:00Z", "durationSec": 180,
            "transcript": "Caller: I want my 2 BHK flat in Pune redone. 1000 sq ft. Budget 10 lakh.",
        }).encode()
        req = urllib.request.Request(BASE + "/api/vaani-webhook", data=body, headers={"content-type": "application/json"})
        urllib.request.urlopen(req, timeout=10)
        self.open()
        self.wait.until(lambda d: len(d.find_elements(*tid("call-row"))) == 1)
        row = self.driver.find_element(*tid("call-row"))
        self.assertIn("Selenium Caller", row.text)
        self.assertEqual(row.find_element(*tid("row-qualification")).text.lower(), "qualified")
        self.driver.find_element(*tid("refresh")).click()
        self.ready()
        self.assertEqual(self.kpi("calls"), "1")
        self.assertEqual(self.kpi("qualified"), "1")

    # 10
    def test_10_no_horizontal_scroll_on_a_phone_width(self):
        self.driver.set_window_size(390, 900)
        self.open()
        scroll = self.driver.execute_script("return document.documentElement.scrollWidth <= window.innerWidth + 1")
        self.driver.set_window_size(1400, 1000)
        self.assertTrue(scroll)


if __name__ == "__main__":
    unittest.main(verbosity=2)
