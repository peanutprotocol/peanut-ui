"""Publish a small, public-safe Play Vitals state for Chip's incident router."""

import argparse
import hashlib
import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import play_vitals_report

RATE_THRESHOLD = 1.09
SEVERITY_RANK = {"P3": 1, "P2": 2, "P1": 3}


def severity(users):
    return "P1" if users >= 5 else "P2" if users >= 2 else "P3"


def issue_key(issue_id):
    return hashlib.sha256(issue_id.encode()).hexdigest()


def assess(snapshot, previous):
    """Return current, sanitized signals and private deduplication state."""
    baseline = not previous.get("seeded")
    now = datetime.fromisoformat(snapshot["checked_at"])
    old_issues = previous.get("issues") or {}
    saved = dict(old_issues)
    signals = []
    for item in snapshot["issues"]:
        key = issue_key(item["id"])
        prior = old_issues.get(key) or {}
        fresh = not prior or item["last"] > prior.get("last", "") or item["users"] > prior.get("users", 0)
        level = "P3" if baseline else severity(item["users"]) if fresh else prior.get("severity", "P3")
        if prior and SEVERITY_RANK[prior.get("severity", "P3")] > SEVERITY_RANK[level]:
            level = prior["severity"]
        signals.append({"key": "play-vitals/issue/" + key, "severity": level})
        saved[key] = {"last": max(item["last"], prior.get("last", "")), "users": item["users"],
                      "severity": level, "seen_at": snapshot["checked_at"]}
    cutoff = now - timedelta(days=120)
    saved = {key: value for key, value in saved.items()
             if datetime.fromisoformat(value["seen_at"]) >= cutoff}

    rate_state = previous.get("rate") or {}
    point = snapshot.get("rate")
    rate_signal = None
    if point is not None:
        high = point["percent"] >= RATE_THRESHOLD
        if high:
            level = "P3" if baseline or (rate_state.get("high") and point["day"] == rate_state.get("day")
                                         and rate_state.get("severity") == "P3") else "P2"
            rate_signal = {"severity": level}
        else:
            level = None
            rate_signal = {"severity": None}
        rate_state = {"day": point["day"], "high": high, "severity": level}
    artifact = {"schema": 1, "checked_at": snapshot["checked_at"], "issues": signals, "rate": rate_signal}
    return artifact, {"seeded": True, "issues": saved, "rate": rate_state}


def load_state(path):
    try:
        with path.open() as file:
            value = json.load(file)
        if not isinstance(value, dict):
            raise ValueError("Play state is not an object")
        return value
    except FileNotFoundError:
        return {}


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, prefix=".play-vitals-", delete=False) as file:
            name = file.name
            json.dump(value, file, separators=(",", ":"))
        os.replace(name, path)
    finally:
        if name and os.path.exists(name):
            os.unlink(name)


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    snapshot = play_vitals_report.collect(datetime.now(timezone.utc))
    artifact, state = assess(snapshot, load_state(args.state))
    if not args.dry_run:
        save_json(args.output, artifact)
        save_json(args.state, state)
    print("Play Vitals check completed%s" % (" (dry run)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
