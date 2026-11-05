package me.peanut.wallet;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.sumsub.sns.core.data.model.SNSException;

import io.sentry.Sentry;
import io.sentry.SentryLevel;

/*
 * Sumsub's Android SDK (1.46.0) turns a failed request into an SNSException and
 * resumes coroutines that have no exception handler with it, so one dropped
 * connection reached the default handler and killed the app mid-verification
 * (PEANUT-UI-TS7). Kotlin hands an uncaught coroutine exception straight to the
 * handler without unwinding the worker thread, so returning here keeps the app
 * alive: the SDK screen stays open and the user can retry or close it.
 *
 * Only Sumsub's network and API failures on a background thread are kept alive.
 * A main-thread exception is always fatal: returning would leave a dead looper.
 */
final class SumsubCrashGuard implements Thread.UncaughtExceptionHandler {
    private static boolean lifecycleHooked;

    @Nullable
    private final Thread.UncaughtExceptionHandler next;

    private SumsubCrashGuard(@Nullable Thread.UncaughtExceptionHandler next) {
        this.next = next;
    }

    static void install(Application app) {
        wrapDefaultHandler();
        if (lifecycleHooked) return;
        lifecycleHooked = true;
        // A handler installed after ours would run first, so re-wrap whenever the SDK opens.
        app.registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
            @Override
            public void onActivityCreated(@NonNull Activity activity, @Nullable Bundle state) {
                if (activity.getClass().getName().startsWith("com.sumsub.")) wrapDefaultHandler();
            }

            @Override
            public void onActivityStarted(@NonNull Activity activity) {}

            @Override
            public void onActivityResumed(@NonNull Activity activity) {}

            @Override
            public void onActivityPaused(@NonNull Activity activity) {}

            @Override
            public void onActivityStopped(@NonNull Activity activity) {}

            @Override
            public void onActivitySaveInstanceState(@NonNull Activity activity, @NonNull Bundle state) {}

            @Override
            public void onActivityDestroyed(@NonNull Activity activity) {}
        });
    }

    static synchronized void wrapDefaultHandler() {
        Thread.UncaughtExceptionHandler current = Thread.getDefaultUncaughtExceptionHandler();
        if (current instanceof SumsubCrashGuard) return;
        Thread.setDefaultUncaughtExceptionHandler(new SumsubCrashGuard(current));
    }

    static boolean shouldKeepAlive(Throwable error, boolean onMainThread) {
        return !onMainThread && (error instanceof SNSException.Network || error instanceof SNSException.Api);
    }

    @Override
    public void uncaughtException(@NonNull Thread thread, @NonNull Throwable error) {
        if (shouldKeepAlive(error, thread == Looper.getMainLooper().getThread())) {
            try {
                Sentry.captureException(error, scope -> {
                    scope.setLevel(SentryLevel.ERROR);
                    scope.setTag("critical_flow", "kyc");
                    scope.setTag("sumsub_sdk", "native");
                    scope.setTag("sumsub_crash_guard", "kept_alive");
                    scope.setExtra("thread", thread.getName());
                });
            } catch (Throwable ignored) {}
            return;
        }
        if (next != null) next.uncaughtException(thread, error);
    }
}
