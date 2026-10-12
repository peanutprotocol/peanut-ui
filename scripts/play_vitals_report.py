"""Read user-perceived Android crashes with the existing Play release identity.

This module only reads Google Play Developer Reporting API data. The caller owns
alert routing and persistence. Never log the service-account JSON or API bodies.
"""

import base64
import json
import math
import os
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

API = "https://playdeveloperreporting.googleapis.com/v1beta1"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/playdeveloperreporting"
PACKAGE = "me.peanut.wallet"
PLAY_URL = ("https://play.google.com/console/u/4/developers/6236117264631812663/"
            "app/4974177704452980366/vitals/crashes?days=28&isUserPerceived=true")


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def assertion(credentials, now):
    """Sign a short-lived OAuth assertion without logging or persisting the key."""
    header = _b64(b'{"alg":"RS256","typ":"JWT"}')
    payload = _b64(json.dumps({"iss": credentials["client_email"], "scope": SCOPE,
                               "aud": TOKEN_URL, "iat": int(now.timestamp()),
                               "exp": int(now.timestamp()) + 3600}, separators=(",", ":")).encode())
    message = (header + "." + payload).encode("ascii")
    key_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", prefix="play-vitals-key-", delete=False) as key:
            key_path = key.name
            key.write(credentials["private_key"])
        signed = subprocess.run(["openssl", "dgst", "-sha256", "-sign", key_path], input=message,
                                capture_output=True, check=True, timeout=10)
        return message.decode("ascii") + "." + _b64(signed.stdout)
    finally:
        if key_path:
            os.unlink(key_path)


def request(url, *, token=None, data=None):
    headers = {"Accept": "application/json", "User-Agent": "peanut-ui/play-vitals"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if data is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(data).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers, data=data), timeout=25) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError("Play Reporting HTTP %d at %s" % (error.code, url.split("?")[0])) from None


def token(credentials, now):
    body = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                   "assertion": assertion(credentials, now)}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(TOKEN_URL, data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded",
                         "User-Agent": "peanut-ui/play-vitals"}), timeout=25) as response:
            return json.load(response)["access_token"]
    except (urllib.error.HTTPError, urllib.error.URLError, KeyError, ValueError):
        raise RuntimeError("Play Reporting OAuth token request failed") from None


def pages(path, field, access_token, params=None):
    rows, page_token = [], None
    while True:
        query = dict(params or {})
        if page_token:
            query["pageToken"] = page_token
        url = API + path + ("?" + urllib.parse.urlencode(query) if query else "")
        payload = request(url, token=access_token)
        if not isinstance(payload, dict) or not isinstance(payload.get(field, []), list):
            raise RuntimeError("Play Reporting returned invalid %s data" % field)
        rows.extend(payload.get(field, []))
        page_token = payload.get("nextPageToken")
        if not page_token:
            return rows


def app_name(access_token):
    for app in pages("/apps:search", "apps", access_token, {"pageSize": 1000}):
        if app.get("packageName") == PACKAGE and app.get("name", "").startswith("apps/"):
            return app["name"]
    raise RuntimeError("Play Reporting identity cannot see %s" % PACKAGE)


def issue_rows(access_token, app, now):
    end = now.replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(hours=72)
    params = {"interval.startTime.year": start.year, "interval.startTime.month": start.month,
              "interval.startTime.day": start.day, "interval.startTime.hours": start.hour,
              "interval.startTime.timeZone.id": "UTC", "interval.endTime.year": end.year,
              "interval.endTime.month": end.month, "interval.endTime.day": end.day,
              "interval.endTime.hours": end.hour, "interval.endTime.timeZone.id": "UTC",
              "filter": "errorIssueType = CRASH AND isUserPerceived", "pageSize": 1000}
    return pages("/%s/errorIssues:search" % app, "errorIssues", access_token, params)


def rate_rows(access_token, app, now):
    today = now.astimezone(ZoneInfo("America/Los_Angeles")).date()
    start = today - timedelta(days=14)
    body = {"timelineSpec": {"aggregationPeriod": "DAILY",
                             "startTime": {"year": start.year, "month": start.month, "day": start.day},
                             "endTime": {"year": today.year, "month": today.month, "day": today.day}},
            "metrics": ["userPerceivedCrashRate7dUserWeighted"], "pageSize": 1000}
    result = request(API + "/%s/crashRateMetricSet:query" % app, token=access_token, data=body)
    if not isinstance(result, dict) or not isinstance(result.get("rows", []), list):
        raise RuntimeError("Play Reporting returned invalid crash-rate data")
    return result.get("rows", [])


def summarize(issues, rates, now):
    """Keep counts and links only; exclude report text, traces and device data."""
    selected = []
    for row in issues:
        name = row.get("name", "")
        if not name.startswith("apps/") or not row.get("lastErrorReportTime"):
            raise RuntimeError("Play Reporting returned an invalid crash issue")
        link = row.get("issueUri", "")
        if not isinstance(link, str) or not link.startswith("https://play.google.com/console/"):
            link = PLAY_URL
        selected.append({"id": name.rsplit("/", 1)[-1], "users": int(row.get("distinctUsers") or 0),
                         "reports": int(row.get("errorReportCount") or 0),
                         "last": row["lastErrorReportTime"],
                         "version": str((row.get("lastAppVersion") or {}).get("versionCode") or "unknown")[:30],
                         "url": link})
    points = []
    for row in rates:
        date = row.get("startTime") or {}
        for metric in row.get("metrics") or []:
            if metric.get("metric") == "userPerceivedCrashRate7dUserWeighted":
                value = metric.get("decimalValue")
                value = value.get("value") if isinstance(value, dict) else value
                value = float(value)
                if not math.isfinite(value) or value < 0:
                    raise RuntimeError("Play Reporting returned an invalid crash rate")
                points.append(("%04d-%02d-%02d" % (date["year"], date["month"], date["day"]), value))
    rate = None
    if points:
        day, value = max(points)
        if datetime.fromisoformat(day).date() >= (now - timedelta(days=4)).date():
            rate = {"day": day, "percent": value}
    return {"schema": 1, "checked_at": now.isoformat(), "issues": selected, "rate": rate}


def collect(now=None):
    now = now or datetime.now(timezone.utc)
    raw = os.environ.get("PLAY_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise RuntimeError("PLAY_SERVICE_ACCOUNT_JSON is missing")
    try:
        credentials = json.loads(raw)
        access_token = token(credentials, now)
    except (ValueError, KeyError, TypeError):
        raise RuntimeError("PLAY_SERVICE_ACCOUNT_JSON is invalid") from None
    app = app_name(access_token)
    return summarize(issue_rows(access_token, app, now), rate_rows(access_token, app, now), now)
