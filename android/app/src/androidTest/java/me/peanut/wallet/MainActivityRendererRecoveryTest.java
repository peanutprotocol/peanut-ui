package me.peanut.wallet;

import static org.junit.Assert.*;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.webkit.WebView;
import android.webkit.WebViewRenderProcess;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Run on a disposable emulator: these tests deliberately terminate its app WebView renderer. */
@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 29)
public class MainActivityRendererRecoveryTest {
    @Test
    public void ordinaryResumeKeepsTheActivityAndWebView() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<MainActivity> original = new AtomicReference<>();
            AtomicReference<WebView> webView = new AtomicReference<>();
            scenario.onActivity(activity -> {
                original.set(activity);
                webView.set(activity.getBridge().getWebView());
            });
            scenario.moveToState(Lifecycle.State.CREATED);
            scenario.moveToState(Lifecycle.State.RESUMED);
            scenario.onActivity(activity -> {
                assertSame(original.get(), activity);
                assertSame(webView.get(), activity.getBridge().getWebView());
            });
        }
    }

    @Test
    public void backgroundRendererLossRebuildsTheBridgeOnReturn() {
        verifyRendererRecovery(true, false);
    }

    @Test
    public void foregroundRendererLossRebuildsTheBridge() {
        verifyRendererRecovery(false, false);
    }

    @Test
    public void newDeepLinkWhileRecoveryIsPendingReachesTheReplacement() {
        verifyRendererRecovery(true, true);
    }

    private void verifyRendererRecovery(boolean background, boolean newLink) {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Intent launch = new Intent(instrumentation.getTargetContext(), MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse("https://peanut.me/home?renderer-test=original"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        // ActivityScenario matches replacement activities by their launch Intent.
        // Recovery deliberately replaces that Intent to avoid replaying a link,
        // so observe the real lifecycle independently for these tests.
        MainActivity original = (MainActivity) instrumentation.startActivitySync(launch);
        AtomicReference<MainActivity> replacement = new AtomicReference<>();
        try {
            AtomicReference<WebView> oldView = new AtomicReference<>();
            AtomicReference<WebViewRenderProcess> renderer = new AtomicReference<>();
            await("A running WebView renderer", () -> {
                oldView.set(original.getBridge().getWebView());
                renderer.set(oldView.get().getWebViewRenderProcess());
                return renderer.get() != null;
            });
            if (background) {
                instrumentation.runOnMainSync(() -> assertTrue(original.moveTaskToBack(true)));
                await("The activity to stop", () -> original.getLifecycle().getCurrentState() == Lifecycle.State.CREATED);
            }
            instrumentation.runOnMainSync(() -> assertTrue(renderer.get().terminate()));
            await("The dead bridge to be disposed", () -> original.getBridge() == null);

            if (background) {
                instrumentation.runOnMainSync(() -> {
                    assertEquals(Lifecycle.State.CREATED, original.getLifecycle().getCurrentState());
                    if (newLink) original.onNewIntent(new Intent(launch)
                            .setData(Uri.parse("https://peanut.me/home?renderer-test=new")));
                    // Return through recents without sending another launch Intent.
                    for (ActivityManager.AppTask task : original.getSystemService(ActivityManager.class).getAppTasks()) {
                        if (task.getTaskInfo().taskId == original.getTaskId()) task.moveToFront();
                    }
                });
            }

            await("A replacement foreground activity", () -> {
                for (Activity activity : ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED)) {
                    if (activity instanceof MainActivity && activity != original) {
                        replacement.set((MainActivity) activity);
                        return replacement.get().getBridge() != null;
                    }
                }
                return false;
            });
            instrumentation.runOnMainSync(() -> {
                assertNotSame(oldView.get(), replacement.get().getBridge().getWebView());
                if (newLink) {
                    assertEquals("https://peanut.me/home?renderer-test=new", replacement.get().getIntent().getDataString());
                } else {
                    assertNull("Recovery must not replay the original launch link", replacement.get().getIntent().getData());
                }
            });

            AtomicBoolean documentReady = new AtomicBoolean();
            await("The replacement document to load and execute JavaScript", () -> {
                replacement.get().getBridge().getWebView().evaluateJavascript(
                        "document.readyState === 'complete' && document.body !== null",
                        value -> documentReady.set("true".equals(value)));
                return documentReady.get();
            });
        } finally {
            instrumentation.runOnMainSync(() -> {
                original.finish();
                if (replacement.get() != null) replacement.get().finish();
            });
            instrumentation.waitForIdleSync();
        }
    }

    private void await(String description, BooleanSupplier condition) {
        AtomicBoolean satisfied = new AtomicBoolean();
        long deadline = SystemClock.uptimeMillis() + 30_000;
        while (!satisfied.get() && SystemClock.uptimeMillis() < deadline) {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> satisfied.set(condition.getAsBoolean()));
            SystemClock.sleep(50);
        }
        assertTrue(description, satisfied.get());
    }
}
