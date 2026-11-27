"""Play Vitals state sent to Chip contains no crash report details."""

import unittest
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import play_vitals_alert as alert

NOW = datetime(2026, 9, 29, 12, tzinfo=timezone.utc).isoformat()


def snapshot(users=1, last="2026-09-29T11:00:00Z", rate=None, version="21755215", extra=()):
    return {"schema": 1, "checked_at": NOW,
            "issues": [{"id": "issue-1", "users": users, "reports": users + 1,
                        "last": last, "version": version,
                        "url": "https://play.google.com/console/issue"}, *extra],
            "rate": rate}


def other(version, last="2026-09-29T11:00:00Z"):
    return {"id": "issue-2", "users": 1, "reports": 1, "last": last, "version": version,
            "url": "https://play.google.com/console/issue"}


class PlayVitalsAlertTest(unittest.TestCase):
    CREDENTIALS = {"private_key": "test-only-key"}

    def test_baseline_and_unchanged_issue_stay_p3(self):
        first, state = alert.assess(snapshot(users=6), {})
        self.assertEqual(first["issues"][0]["severity"], "P3")
        second, _ = alert.assess(snapshot(users=6), state)
        self.assertEqual(second["issues"][0]["severity"], "P3")
        self.assertNotIn("issue-1", str(first))
        self.assertNotIn("21755215", str(first))
        self.assertNotIn("issue-1", str(state))

    def test_new_issue_and_escalation(self):
        _, state = alert.assess({"checked_at": NOW, "issues": [], "rate": None}, {})
        new, state = alert.assess(snapshot(users=1), state)
        self.assertEqual(new["issues"][0]["severity"], "P3")
        higher, state = alert.assess(snapshot(users=5, last="2026-09-29T12:00:00Z"), state)
        self.assertEqual(higher["issues"][0]["severity"], "P1")
        repeated, _ = alert.assess(snapshot(users=5), state)
        self.assertEqual(repeated["issues"][0]["severity"], "P1")

    def seeded(self):
        return alert.assess({"checked_at": NOW, "issues": [], "rate": None}, {})[1]

    def test_a_fixed_crash_falls_as_its_users_fall(self):
        # TASK-25474: the old rule never lowered a level, so a fixed crash paged P1 for days.
        high, state = alert.assess(snapshot(users=6, last="2026-09-29T11:00:00Z"), self.seeded())
        self.assertEqual(high["issues"][0]["severity"], "P1")
        lower, _ = alert.assess(snapshot(users=2, last="2026-09-29T11:30:00Z"), state)
        self.assertEqual(lower["issues"][0]["severity"], "P2")

    def test_a_quiet_crash_drops_to_the_digest(self):
        _, state = alert.assess(snapshot(users=6, last="2026-09-29T11:00:00Z"), self.seeded())
        quiet, _ = alert.assess(snapshot(users=6, last="2026-09-28T11:00:00Z"), state)
        self.assertEqual(quiet["issues"][0]["severity"], "P3")

    def test_a_crash_only_on_an_old_build_pages_p2(self):
        newer = other("21755300")
        capped, state = alert.assess(snapshot(users=6, extra=[newer]), self.seeded())
        self.assertEqual(capped["issues"][0]["severity"], "P2")
        # The newest build is remembered, so the cap holds after the newer crash stops.
        again, _ = alert.assess(snapshot(users=7, last="2026-09-29T11:30:00Z"), state)
        self.assertEqual(again["issues"][0]["severity"], "P2")
        current, _ = alert.assess(snapshot(users=6, version="21755300"), self.seeded())
        self.assertEqual(current["issues"][0]["severity"], "P1")

    def test_rate_starts_as_digest_then_escalates_on_new_day(self):
        high = {"day": "2026-09-28", "percent": 1.20}
        first, state = alert.assess(snapshot(rate=high), {})
        self.assertEqual(first["rate"]["severity"], "P3")
        same_day, state = alert.assess(snapshot(rate=high), state)
        self.assertEqual(same_day["rate"]["severity"], "P3")
        next_day = {"day": "2026-09-29", "percent": 1.20}
        raised, state = alert.assess(snapshot(rate=next_day), state)
        self.assertEqual(raised["rate"]["severity"], "P2")
        low, _ = alert.assess(snapshot(rate={"day": "2026-09-30", "percent": 0.5}), state)
        self.assertIsNone(low["rate"]["severity"])

    def test_cache_encrypts_counts_and_report_times(self):
        _, state = alert.assess(snapshot(users=6), {})
        envelope = alert.encode_state(state, self.CREDENTIALS)
        self.assertEqual(alert.decode_state(envelope, self.CREDENTIALS), state)
        self.assertNotIn("2026-09-29T11:00:00Z", str(envelope))
        self.assertNotIn('"users":6', str(envelope))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            alert.save_json(path, envelope)
            self.assertEqual(alert.load_state(path, self.CREDENTIALS), state)
            self.assertNotIn("2026-09-29T11:00:00Z", path.read_text())

    def test_cache_rejects_tampering_and_key_rotation(self):
        envelope = alert.encode_state({"seeded": True}, self.CREDENTIALS)
        with self.assertRaisesRegex(RuntimeError, "authenticated"):
            alert.decode_state(envelope, {"private_key": "rotated-key"})
        envelope["ciphertext"] = envelope["ciphertext"][:-4] + "AAAA"
        with self.assertRaisesRegex(RuntimeError, "authenticated"):
            alert.decode_state(envelope, self.CREDENTIALS)


if __name__ == "__main__":
    unittest.main()
