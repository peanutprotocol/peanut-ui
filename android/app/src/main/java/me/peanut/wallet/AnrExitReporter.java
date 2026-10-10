package me.peanut.wallet;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.RequiresApi;

import io.sentry.Sentry;
import io.sentry.SentryLevel;

// Sentry's ApplicationExitInfo ANR events omit the system's ANR reason; send it once, matchable by anr.ts.
final class AnrExitReporter {
    private static final String PREFS = "peanut_anr_exit";
    private static final String LAST_REPORTED_AT = "lastReportedAt";
    private static final long MAX_AGE_MS = 90L * 24 * 60 * 60 * 1000;
    private static boolean started;

    private AnrExitReporter() {}

    static void reportLatest(Context context) {
        if (started || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        started = true;
        try {
            Context app = context.getApplicationContext();
            new Thread(() -> {
                try {
                    report(app);
                } catch (Throwable ignored) {}
            }, "AnrExitReporter").start();
        } catch (Throwable ignored) {}
    }

    @RequiresApi(api = Build.VERSION_CODES.R)
    private static void report(Context context) {
        if (!Sentry.isEnabled()) return;
        ActivityManager activityManager = context.getSystemService(ActivityManager.class);
        if (activityManager == null) return;

        ApplicationExitInfo anr = null;
        for (ApplicationExitInfo exit : activityManager.getHistoricalProcessExitReasons(null, 0, 0)) {
            if (exit.getReason() == ApplicationExitInfo.REASON_ANR) {
                anr = exit;
                break;
            }
        }
        if (anr == null) return;

        long timestamp = anr.getTimestamp();
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (timestamp <= prefs.getLong(LAST_REPORTED_AT, 0)) return;
        prefs.edit().putLong(LAST_REPORTED_AT, timestamp).commit();
        if (System.currentTimeMillis() - timestamp > MAX_AGE_MS) return;

        String description = String.valueOf(anr.getDescription());
        int importance = anr.getImportance();
        long pss = anr.getPss();
        long rss = anr.getRss();
        Sentry.captureMessage("Android ANR exit reason", SentryLevel.INFO, scope -> {
            scope.setTag("anr.ts", String.valueOf(timestamp));
            scope.setTag("anr.importance", String.valueOf(importance));
            scope.setTag("anr.pss_kb", String.valueOf(pss));
            scope.setTag("anr.rss_kb", String.valueOf(rss));
            scope.setTag("anr.description", description.length() > 200 ? description.substring(0, 200) : description);
            scope.setExtra("anr.description", description);
        });
    }
}
