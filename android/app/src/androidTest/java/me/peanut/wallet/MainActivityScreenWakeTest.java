package me.peanut.wallet;

import static org.junit.Assert.*;

import android.app.Instrumentation;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.os.PowerManager;
import android.os.SystemClock;
import android.view.PixelCopy;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Disposable emulator/device only: changes display timeout temporarily. */
@RunWith(AndroidJUnit4.class)
@SdkSuppress(minSdkVersion = 26)
public class MainActivityScreenWakeTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private final AtomicReference<MainActivity> activity = new AtomicReference<>();
    private final AtomicReference<WebView> page = new AtomicReference<>();

    @Before
    public void wakeTestDevice() throws Exception {
        wake();
    }

    @Test
    public void displayTimeoutThenWakeKeepsTheLivePagePainted() throws Exception {
        String timeout = shell("settings get system screen_off_timeout");
        String stayAwake = shell("settings get global stay_on_while_plugged_in");
        try (ActivityScenario<MainActivity> scenario = openPage()) {
            shell("settings put global stay_on_while_plugged_in 0");
            shell("settings put system screen_off_timeout 1000");
            shell("input keyevent KEYCODE_WAKEUP");
            await("display timeout", () -> !power().isInteractive());
            // Give pixel/state assertions a foreground window; do not let the
            // one-second test timeout lock the screen again during assertions.
            shell("settings put system screen_off_timeout 60000");
            wake();
            assertPageAndPixels(scenario);
        } finally {
            shell("settings put system screen_off_timeout " + timeout);
            shell("settings put global stay_on_while_plugged_in " + stayAwake);
            wake();
        }
    }

    @Test
    public void repeatedLockWakeDoesNotReloadOrLoseFormState() throws Exception {
        try (ActivityScenario<MainActivity> scenario = openPage()) {
            for (int i = 0; i < 3; i++) {
                shell("input keyevent KEYCODE_SLEEP");
                await("screen off", () -> !power().isInteractive());
                wake();
                assertPageAndPixels(scenario);
            }
        } finally {
            wake();
        }
    }

    @Test
    public void switchingAppsAfterWakeKeepsTheSameDocument() throws Exception {
        try (ActivityScenario<MainActivity> scenario = openPage()) {
            shell("input keyevent KEYCODE_SLEEP");
            await("screen off", () -> !power().isInteractive());
            wake();
            shell("input keyevent KEYCODE_HOME");
            await("app backgrounded", () -> !activity.get().hasWindowFocus());
            shell("am start -n me.peanut.wallet/.MainActivity");
            assertPageAndPixels(scenario);
        }
    }

    @Test
    public void focusReturnResumesALiveWebViewPausedAfterActivityResume() {
        try (ActivityScenario<MainActivity> scenario = openPage()) {
            // Exercise the gap independently of OEM timing: the Activity is
            // already resumed, but its live WebView stops producing frames
            // while focus is elsewhere. No onRenderProcessGone is involved.
            instrumentation.runOnMainSync(() -> {
                activity.get().onWindowFocusChanged(false);
                page.get().onPause();
                page.get().evaluateJavascript(
                        "window.__focusFrame = false; requestAnimationFrame(() => { window.__focusFrame = true; });", null);
            });
            SystemClock.sleep(250);
            AtomicBoolean paused = new AtomicBoolean();
            await("frame is parked while WebView is paused", () -> {
                page.get().evaluateJavascript("window.__focusFrame === false", value -> paused.set("true".equals(value)));
                return paused.get();
            });
            instrumentation.runOnMainSync(() -> activity.get().onWindowFocusChanged(true));
            AtomicBoolean frame = new AtomicBoolean();
            await("focus returns without needing another Activity resume", () -> {
                page.get().evaluateJavascript("window.__focusFrame === true", value -> frame.set("true".equals(value)));
                return frame.get();
            });
            assertPageAndPixels(scenario);
        }
    }

    private ActivityScenario<MainActivity> openPage() {
        ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class);
        scenario.onActivity(current -> {
            activity.set(current);
            page.set(current.getBridge().getWebView());
        });
        AtomicBoolean ready = new AtomicBoolean();
        await("fixture document ready", () -> {
            page.get().evaluateJavascript("document.readyState === 'complete'", value -> ready.set("true".equals(value)));
            return ready.get();
        });
        instrumentation.runOnMainSync(() -> page.get().evaluateJavascript(
                "window.__wakeSentinel = 'same-document';"
                + "document.body.innerHTML = '<input id=retained value=unsent-draft>';"
                + "document.documentElement.style.cssText='background:rgb(20,100,220);height:100%';"
                + "document.body.style.cssText='background:rgb(20,100,220);margin:0;min-height:100vh';", null));
        assertPageAndPixels(scenario);
        return scenario;
    }

    private void wake() throws Exception {
        shell("input keyevent KEYCODE_WAKEUP");
        shell("wm dismiss-keyguard");
    }

    private PowerManager power() {
        return instrumentation.getTargetContext().getSystemService(PowerManager.class);
    }

    private void assertPageAndPixels(ActivityScenario<MainActivity> scenario) {
        await("foreground window focus", () -> power().isInteractive() && activity.get().hasWindowFocus());
        scenario.onActivity(current -> {
            assertSame("Wake must preserve the Activity", activity.get(), current);
            assertSame("Wake must preserve the WebView", page.get(), current.getBridge().getWebView());
        });
        AtomicBoolean intact = new AtomicBoolean();
        await("same JavaScript document and unsent form", () -> {
            page.get().evaluateJavascript(
                    "window.__wakeSentinel === 'same-document' && document.getElementById('retained')?.value === 'unsent-draft'",
                    value -> intact.set("true".equals(value)));
            return intact.get();
        });
        // Read actual window pixels, not just DOM readiness: a working JS
        // engine behind a blank compositor surface would pass the check above.
        // Check again after the first frame to catch the reported brief flash.
        assertBlueFrame();
        SystemClock.sleep(750);
        assertBlueFrame();
    }

    private void assertBlueFrame() {
        AtomicBoolean blue = new AtomicBoolean();
        await("painted WebView frame", () -> {
            Bitmap bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
            int[] location = new int[2];
            page.get().getLocationInWindow(location);
            int x = location[0] + page.get().getWidth() / 2;
            int y = location[1] + page.get().getHeight() / 2;
            PixelCopy.request(activity.get().getWindow(), new Rect(x, y, x + 1, y + 1), bitmap, status -> {
                if (status == PixelCopy.SUCCESS) {
                    int pixel = bitmap.getPixel(0, 0);
                    blue.set(Color.blue(pixel) > 180 && Color.red(pixel) < 60 && Color.green(pixel) < 140);
                }
                bitmap.recycle();
            }, new Handler(Looper.getMainLooper()));
            return blue.get();
        });
    }

    private String shell(String command) throws Exception {
        try (InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(
                instrumentation.getUiAutomation().executeShellCommand(command));
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name()).trim();
        }
    }

    private void await(String description, BooleanSupplier condition) {
        AtomicBoolean satisfied = new AtomicBoolean();
        long deadline = SystemClock.uptimeMillis() + 30_000;
        while (!satisfied.get() && SystemClock.uptimeMillis() < deadline) {
            instrumentation.runOnMainSync(() -> satisfied.set(condition.getAsBoolean()));
            SystemClock.sleep(50);
        }
        assertTrue(description, satisfied.get());
    }
}
