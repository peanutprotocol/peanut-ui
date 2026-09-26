package me.peanut.wallet;

import static org.junit.Assert.*;

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
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
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
        Intent launch = new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse("https://peanut.me/home?renderer-test=original"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(launch)) {
            AtomicReference<MainActivity> original = new AtomicReference<>();
            AtomicReference<WebView> oldView = new AtomicReference<>();
            AtomicReference<WebViewRenderProcess> renderer = new AtomicReference<>();
            long deadline = SystemClock.uptimeMillis() + 15_000;
            while (renderer.get() == null && SystemClock.uptimeMillis() < deadline) {
                scenario.onActivity(activity -> {
                    original.set(activity);
                    oldView.set(activity.getBridge().getWebView());
                    renderer.set(oldView.get().getWebViewRenderProcess());
                });
                SystemClock.sleep(50);
            }
            assertNotNull("The test requires a running WebView renderer", renderer.get());
            if (background) scenario.moveToState(Lifecycle.State.CREATED);

            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> assertTrue(renderer.get().terminate()));

            // The failed bridge must be cleared before another native lifecycle
            // event can call into the destroyed WebView.
            AtomicBoolean disposed = new AtomicBoolean();
            deadline = SystemClock.uptimeMillis() + 15_000;
            while (!disposed.get() && SystemClock.uptimeMillis() < deadline) {
                InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
                        disposed.set(original.get().getBridge() == null));
                SystemClock.sleep(50);
            }
            assertTrue("The dead bridge was not disposed", disposed.get());
            if (background) {
                assertEquals(Lifecycle.State.CREATED, scenario.getState());
                if (newLink) InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
                        original.get().onNewIntent(new Intent(launch)
                                .setData(Uri.parse("https://peanut.me/home?renderer-test=new"))));
                scenario.moveToState(Lifecycle.State.RESUMED);
            }

            AtomicBoolean rebuilt = new AtomicBoolean();
            deadline = SystemClock.uptimeMillis() + 15_000;
            while (!rebuilt.get() && SystemClock.uptimeMillis() < deadline) {
                scenario.onActivity(activity -> {
                    if (activity != original.get() && activity.getBridge() != null) {
                        assertNotSame(oldView.get(), activity.getBridge().getWebView());
                        if (newLink) {
                            assertEquals("https://peanut.me/home?renderer-test=new", activity.getIntent().getDataString());
                        } else {
                            assertNull("Recovery must not replay the original launch link", activity.getIntent().getData());
                        }
                        rebuilt.set(true);
                    }
                });
                SystemClock.sleep(50);
            }
            assertTrue("No replacement Activity and WebView after renderer loss", rebuilt.get());

            AtomicBoolean documentReady = new AtomicBoolean();
            deadline = SystemClock.uptimeMillis() + 15_000;
            while (!documentReady.get() && SystemClock.uptimeMillis() < deadline) {
                scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
                        "document.readyState === 'complete' && document.body !== null",
                        value -> documentReady.set("true".equals(value))));
                SystemClock.sleep(50);
            }
            assertTrue("The replacement WebView must load and execute JavaScript", documentReady.get());
        }
    }
}
