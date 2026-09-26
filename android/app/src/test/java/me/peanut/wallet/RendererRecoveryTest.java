package me.peanut.wallet;

import static org.junit.Assert.*;

import java.util.ArrayDeque;
import java.util.Queue;
import org.junit.Test;

public class RendererRecoveryTest {
    private final Queue<Runnable> tasks = new ArrayDeque<>();
    private int recreations;
    private final RendererRecovery recovery = createRecovery(-1);

    private RendererRecovery createRecovery(long lastRecoveryAt) {
        return new RendererRecovery(lastRecoveryAt, tasks::add, () -> recreations++);
    }

    private void flush() {
        while (!tasks.isEmpty()) tasks.remove().run();
    }

    @Test
    public void normalAppSwitchesKeepTheExistingPage() {
        recovery.onResume();
        recovery.onPause();
        recovery.onResume();
        flush();
        assertEquals(0, recreations);
    }

    @Test
    public void backgroundRendererLossRecoversOnResume() {
        recovery.onResume();
        recovery.onPause();
        assertTrue(recovery.onRendererGone(100));
        flush();
        assertEquals(0, recreations);
        recovery.onResume();
        flush();
        assertEquals(1, recreations);
    }

    @Test
    public void foregroundRendererLossRecoversAfterTheCallback() {
        recovery.onResume();
        assertTrue(recovery.onRendererGone(100));
        assertEquals(0, recreations);
        flush();
        assertEquals(1, recreations);
    }

    @Test
    public void rapidSwitchAwayDefersQueuedRecoveryUntilNextResume() {
        recovery.onResume();
        recovery.onRendererGone(100);
        recovery.onPause();
        flush();
        assertEquals(0, recreations);
        recovery.onResume();
        flush();
        assertEquals(1, recreations);
    }

    @Test
    public void repeatedCallbacksAndResumesScheduleOnlyOneRecreation() {
        recovery.onResume();
        recovery.onRendererGone(100);
        assertTrue(recovery.onRendererGone(101));
        recovery.onResume();
        flush();
        recovery.onPause();
        recovery.onResume();
        flush();
        assertEquals(1, recreations);
    }

    @Test
    public void destroyedActivityDoesNotRunQueuedRecovery() {
        recovery.onResume();
        recovery.onRendererGone(100);
        recovery.onDestroy();
        flush();
        assertEquals(0, recreations);
        assertFalse(recovery.onRendererGone(101));
    }

    @Test
    public void replacementRendererCannotCauseAnImmediateRestartLoop() {
        recovery.onRendererGone(100);
        RendererRecovery replacement = createRecovery(recovery.getLastRecoveryAt());
        replacement.onResume();
        assertFalse(replacement.onRendererGone(101));
        flush();
        assertEquals(0, recreations);
    }

    @Test
    public void laterIndependentRendererLossCanRecover() {
        RendererRecovery replacement = createRecovery(100);
        replacement.onResume();
        assertTrue(replacement.onRendererGone(60_100));
        flush();
        assertEquals(1, recreations);
    }
}
