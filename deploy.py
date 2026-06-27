"""
One-time deployment script: HF Spaces (backend) + Vercel (frontend).
Run from the repo root on the production branch.

Requirements:
  pip install huggingface_hub python-dotenv
  npm install -g vercel   (or let this script install it)

Usage:
  python deploy.py

Reads from .env — set these before running:
  HF_TOKEN       = your Hugging Face token (hf_...)
  HF_USERNAME    = your Hugging Face username
  HF_SPACE_NAME  = desired space name (default: sarsa-trader-api)
  VERCEL_TOKEN   = your Vercel token
  API_KEY        = Alpaca API key
  API_SECRET     = Alpaca API secret
  BASE_URL       = https://paper-api.alpaca.markets/v2
"""

import os
import sys
import shutil
import subprocess
import tempfile
from pathlib import Path

# ── Bootstrap ────────────────────────────────────────────────────────────────

try:
    from dotenv import load_dotenv
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "python-dotenv"], check=True)
    from dotenv import load_dotenv

load_dotenv(".env")

try:
    from huggingface_hub import HfApi
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "huggingface_hub"], check=True)
    from huggingface_hub import HfApi

# ── Config ───────────────────────────────────────────────────────────────────

def _require(key, prompt):
    val = os.getenv(key, "").strip()
    if not val:
        val = input(f"{prompt}: ").strip()
    return val

HF_TOKEN      = _require("HF_TOKEN",     "Hugging Face token (hf_...)")
HF_USERNAME   = _require("HF_USERNAME",  "Hugging Face username")
HF_SPACE      = os.getenv("HF_SPACE_NAME", "sarsa-trader-api").strip()
VERCEL_TOKEN  = _require("VERCEL_TOKEN", "Vercel token")
VERCEL_SCOPE  = os.getenv("VERCEL_SCOPE", "godcares-ndubuisis-projects").strip()
API_KEY      = os.getenv("API_KEY",  "")
API_SECRET   = os.getenv("API_SECRET","")
BASE_URL     = os.getenv("BASE_URL",  "https://paper-api.alpaca.markets/v2")

REPO_ROOT    = Path(__file__).parent.resolve()
SPACE_REPO   = f"{HF_USERNAME}/{HF_SPACE}"
SPACE_URL    = f"https://{HF_USERNAME.replace('-','--')}-{HF_SPACE.replace('-','--')}.hf.space"

# ── Step 1: HF Spaces ────────────────────────────────────────────────────────

print(f"\n[1/3] Deploying backend to HF Spaces ({SPACE_REPO})...")

api = HfApi(token=HF_TOKEN)

api.create_repo(
    repo_id=SPACE_REPO,
    repo_type="space",
    space_sdk="docker",
    private=False,
    exist_ok=True,
)
print(f"      Space ready: https://huggingface.co/spaces/{SPACE_REPO}")

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    for folder in ["backend", "trading_engine", "logs"]:
        shutil.copytree(REPO_ROOT / folder, tmp / folder)
    shutil.copy(REPO_ROOT / "Dockerfile",    tmp / "Dockerfile")
    shutil.copy(REPO_ROOT / "README.hf.md",  tmp / "README.md")

    api.upload_folder(
        folder_path=str(tmp),
        repo_id=SPACE_REPO,
        repo_type="space",
        commit_message="Deploy SARSA Trader API",
    )

print("      Files uploaded.")

for key, val in {
    "API_KEY":                  API_KEY,
    "API_SECRET":               API_SECRET,
    "BASE_URL":                 BASE_URL,
    "ENABLE_BACKTEST_TRIGGER":  "false",
}.items():
    if val:
        api.add_space_variable(repo_id=SPACE_REPO, key=key, value=val)

print(f"      Env vars set.\n      Backend URL: {SPACE_URL}")

# ── Step 2: Vercel ────────────────────────────────────────────────────────────

print("\n[2/3] Deploying frontend to Vercel...")

IS_WINDOWS = sys.platform == "win32"

if not shutil.which("vercel") and not shutil.which("vercel.cmd"):
    print("      Installing Vercel CLI...")
    subprocess.run("npm install -g vercel", check=True, shell=IS_WINDOWS)

env = {**os.environ, "VITE_API_URL": SPACE_URL}

vercel_cmd = "vercel --cwd {} --token {} --scope {} --yes --prod".format(
    str(REPO_ROOT / "frontend"), VERCEL_TOKEN, VERCEL_SCOPE
)

print("      Running Vercel CLI (output below):")
print("      " + "-" * 50)

ret = subprocess.run(
    vercel_cmd if IS_WINDOWS else [
        "vercel", "--cwd", str(REPO_ROOT / "frontend"),
        "--token", VERCEL_TOKEN, "--scope", VERCEL_SCOPE, "--yes", "--prod",
    ],
    env=env,
    shell=IS_WINDOWS,
)

print("      " + "-" * 50)

if ret.returncode != 0:
    print("      Vercel deploy failed (see output above).")
    sys.exit(1)

vercel_url = input("\n      Paste the deployed Vercel URL from the output above: ").strip()

print(f"      Frontend URL: {vercel_url}")

# ── Step 3: Wire CORS ────────────────────────────────────────────────────────

print("\n[3/3] Setting ALLOWED_ORIGINS on HF Space...")

api.add_space_variable(
    repo_id=SPACE_REPO,
    key="ALLOWED_ORIGINS",
    value=vercel_url,
)

print(f"      ALLOWED_ORIGINS = {vercel_url}")

# ── Done ─────────────────────────────────────────────────────────────────────

print(f"""
Deployment complete!

  Frontend : {vercel_url}
  Backend  : {SPACE_URL}
  API docs : {SPACE_URL}/docs

Next: in your Vercel project dashboard, confirm the env var is set:
  VITE_API_URL = {SPACE_URL}

The HF Space takes 3-5 minutes to build. Check build logs at:
  https://huggingface.co/spaces/{SPACE_REPO}
""")
