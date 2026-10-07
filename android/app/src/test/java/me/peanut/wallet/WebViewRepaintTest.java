package me.peanut.wallet;

import static org.junit.Assert.*;

import java.util.ArrayDeque;
import java.util.Queue;
import org.junit.Test;

public class WebViewRepaintTest {
    private final Queue<Runnable> frames = new ArrayDeque<>();
    private int repaints;
    private final WebViewRepaint recovery = new WebViewRepaint(frames::add, () -> repaints++);

    private void flush() {
        while (!frames.isEmpty()) frames.remove().run();
    }

    @Test
    public void coldStartDoesNotInterfereWithTheSplash() {
        recovery.onResume(false);
        recovery.onWindowFocusChanged(true);
        flush();
        assertEquals(0, repaints);
    }

    @Test
    public void wakeWaitsUntilTheLockScreenReleasesFocus() {
        recovery.onResume(true);
        recovery.onPause();
        recovery.onResume(false);
        flush();
        assertEquals(0, repaints);
        recovery.onWindowFocusChanged(true);
        assertEquals(0, repaints);
        flush();
        assertEquals(1, repaints);
    }

    @Test
    public void focusBeforeResumeAlsoRecovers() {
        recovery.onPause();
        recovery.onWindowFocusChanged(true);
        flush();
        assertEquals(0, repaints);
        recovery.onResume(true);
        flush();
        assertEquals(1, repaints);
    }

    @Test
    public void focusOnlyWakeDoesNotNeedAnotherActivityResume() {
        recovery.onResume(true);
        recovery.onWindowFocusChanged(false);
        recovery.onWindowFocusChanged(true);
        flush();
        assertEquals(1, repaints);
    }

    @Test
    public void rapidRelockCancelsTheOldFrameWithoutLosingTheNextWake() {
        recovery.onResume(true);
        recovery.onPause();
        recovery.onResume(true);
        recovery.onWindowFocusChanged(false);
        flush();
        assertEquals(0, repaints);
        recovery.onWindowFocusChanged(true);
        flush();
        assertEquals(1, repaints);
    }

    @Test
    public void duplicateResumeAndFocusCallbacksOnlyRepaintOnce() {
        recovery.onPause();
        recovery.onResume(true);
        recovery.onResume(true);
        recovery.onWindowFocusChanged(true);
        assertEquals(1, frames.size());
        flush();
        recovery.onWindowFocusChanged(true);
        flush();
        assertEquals(1, repaints);
    }

    @Test
    public void eachSleepWakeCycleCanRecover() {
        for (int i = 0; i < 3; i++) {
            recovery.onPause();
            recovery.onResume(false);
            recovery.onWindowFocusChanged(true);
            flush();
            assertEquals(i + 1, repaints);
        }
    }

    @Test
    public void destroyedActivityCannotRepaintAnOldWebView() {
        recovery.onPause();
        recovery.onResume(true);
        recovery.onDestroy();
        flush();
        assertEquals(0, repaints);
        assertFalse(recovery.isActive());
    }
}
