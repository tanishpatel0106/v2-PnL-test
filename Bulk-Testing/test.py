# bulk_generate_comments_int_periods.py  (v2: handles 77\1 → 1)
"""
▪ Reads accounts.txt  (one GL per line, e.g. 77\1, 77\2, 31100)
▪ For each account:
      1. POST /account_summary    (account_number = part after '\')
      2. POST /comments/generate  (account_id & JSON use full code)
▪ Saves combined results to JSON log.

env-vars: BACKEND_BASE_URL, COMPANY_CODE, SITE_CODE, YEAR, PERIODS_INT, ...
"""

import os, json, asyncio, logging, aiohttp
from datetime import datetime
from pathlib   import Path
from typing    import List, Dict

# ── CONFIG ────────────────────────────────────────────────────────────────
BASE_URL      = os.getenv("BACKEND_BASE_URL", "http://localhost:5000")
COMPANY_CODE  = os.getenv("COMPANY_CODE",  "C077")
SITE_CODE     = os.getenv("SITE_CODE",     "L077")
YEAR          = int(os.getenv("YEAR",      "2025"))
PERIODS_INT   = [int(p) for p in os.getenv("PERIODS_INT", "4,5,6").split(",")]
CONCURRENCY   = int(os.getenv("CONCURRENCY", "4"))
ACCOUNTS_FILE = os.getenv("ACCOUNTS_FILE", "accounts.txt")
OUT_PATH      = Path(os.getenv(
    "OUTPUT_FILE",
    f"bulk_comments_{datetime.utcnow():%Y%m%dT%H%M%SZ}.json"
))

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")
# ──────────────────────────────────────────────────────────────────────────


# ── Helper conversions ────────────────────────────────────────────────────
def tail_after_backslash(code: str) -> str:
    """'77\\1' → '1'   |   '31100' → '31100'"""
    return code.split("\\")[-1]


def periods_for_generate() -> List[str]:
    """[4,5] → ['P4-2025','P5-2025']"""
    return [f"P{p}-{YEAR}" for p in PERIODS_INT]


# ── Payload builders ──────────────────────────────────────────────────────
def payload_account_summary(full_code: str) -> Dict:
    return {
        "company_code":   COMPANY_CODE,
        "site_code":      SITE_CODE,
        "year":           YEAR,
        "periods":        PERIODS_INT,                 # integers
        "account_number": tail_after_backslash(full_code),
    }


def payload_comment_generate(full_code: str, acc_json: Dict) -> Dict:
    return {
        "account_id":     full_code,                   # full code here
        "company_code":   COMPANY_CODE,
        "site_code":      SITE_CODE,
        "periods":        periods_for_generate(),      # 'P4-2025' style
        "account_json":   acc_json,
        "company_info":   "",
    }


# ── Single-account workflow ───────────────────────────────────────────────
async def process_one(session: aiohttp.ClientSession, full_code: str) -> Dict:
    # 1. account_summary
    async with session.post(f"{BASE_URL}/account_summary",
                            json=payload_account_summary(full_code)) as r1:
        if r1.status != 200:
            raise RuntimeError(f"summary {r1.status}: {await r1.text()}")
        acc_json = (await r1.json())["summary"]

    # 2. comments/generate
    async with session.post(f"{BASE_URL}/comments/generate",
                            json=payload_comment_generate(full_code, acc_json)) as r2:
        if r2.status != 200:
            raise RuntimeError(f"generate {r2.status}: {await r2.text()}")
        gen = await r2.json()                          # {summary, final_comment}
        return {"account": full_code, **gen}


async def guarded_process(sem, session, code):
    async with sem:
        try:
            res = await process_one(session, code)
            logging.info("✅ %s done", code)
            return res
        except Exception as exc:
            logging.warning("❌ %s error: %s", code, exc)
            return {"account": code, "error": str(exc)}


# ── Main runner ───────────────────────────────────────────────────────────
async def main(codes: List[str]):
    sem       = asyncio.Semaphore(CONCURRENCY)
    timeout   = aiohttp.ClientTimeout(total=900)
    connector = aiohttp.TCPConnector(limit=0)

    async with aiohttp.ClientSession(timeout=timeout,
                                     connector=connector) as sess:
        tasks   = [guarded_process(sem, sess, c) for c in codes]
        results = await asyncio.gather(*tasks)

    OUT_PATH.write_text(json.dumps(results, indent=2))
    logging.info("🎉 Saved to %s", OUT_PATH.resolve())


if __name__ == "__main__":
    if not Path(ACCOUNTS_FILE).exists():
        logging.error("Missing %s", ACCOUNTS_FILE)
        raise SystemExit(1)

    with open(ACCOUNTS_FILE) as f:
        codes = [ln.strip() for ln in f if ln.strip()]

    logging.info("🔔 %d accounts, %d-way concurrency", len(codes), CONCURRENCY)
    asyncio.run(main(codes))
