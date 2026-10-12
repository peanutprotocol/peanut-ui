"""Play Reporting request and data-minimization contract."""

import unittest
import urllib.parse
from datetime import datetime, timezone
from unittest.mock import patch

import play_vitals_report as report

NOW = datetime(2026, 9, 29, 12, tzinfo=timezone.utc)


class PlayVitalsReportTest(unittest.TestCase):
    def test_issue_query_is_user_perceived_and_hour_aligned(self):
        with patch.object(report, "pages", return_value=[]) as pages:
            report.issue_rows("token", "apps/me.peanut.wallet", NOW)
        path, field, token, params = pages.call_args.args
        self.assertEqual(path, "/apps/me.peanut.wallet/errorIssues:search")
        self.assertEqual((field, token), ("errorIssues", "token"))
        self.assertEqual(params["filter"], "errorIssueType = CRASH AND isUserPerceived")
        self.assertEqual(params["interval.startTime.hours"], 12)
        self.assertEqual(params["interval.startTime.day"], 26)
        self.assertEqual(params["interval.endTime.hours"], 12)

    def test_summary_excludes_report_text_and_untrusted_link(self):
        issues = [{"name": "apps/me.peanut.wallet/errorIssues/one", "distinctUsers": "2",
                   "errorReportCount": "5", "lastErrorReportTime": "2026-09-29T11:00:00Z",
                   "lastAppVersion": {"versionCode": "21755215"},
                   "issueUri": "https://example.com/steal", "reportText": "private stack"}]
        rates = [{"startTime": {"year": 2026, "month": 9, "day": 28},
                  "metrics": [{"metric": "userPerceivedCrashRate7dUserWeighted",
                               "decimalValue": {"value": "1.23"}}]}]
        data = report.summarize(issues, rates, NOW)
        self.assertEqual(data["issues"], [{"id": "one", "users": 2, "reports": 5,
                                           "last": "2026-09-29T11:00:00Z", "version": "21755215",
                                           "url": report.PLAY_URL}])
        self.assertEqual(data["rate"], {"day": "2026-09-28", "percent": 1.23})
        self.assertNotIn("private stack", str(data))

    def test_search_paginates(self):
        with patch.object(report, "request", side_effect=[
                {"apps": [{"packageName": "elsewhere"}], "nextPageToken": "next"},
                {"apps": [{"packageName": report.PACKAGE, "name": "apps/me.peanut.wallet"}]}]) as request:
            self.assertEqual(report.app_name("token"), "apps/me.peanut.wallet")
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(request.call_args_list[1].args[0]).query)
        self.assertEqual(query["pageToken"], ["next"])

    def test_missing_secret_fails_without_fallback(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "PLAY_SERVICE_ACCOUNT_JSON is missing"):
                report.collect(NOW)


if __name__ == "__main__":
    unittest.main()
