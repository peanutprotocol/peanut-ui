package me.peanut.wallet;

import java.util.function.Consumer;

/** Coordinates one Activity rebuild after renderer loss, only while foregrounded. */
final class RendererRecovery {
    private static final long RETRY_WINDOW_MS = 60_000;

    private final Consumer<Runnable> post;
    private final Runnable recreate;
    private long lastRecoveryAt;
    private boolean resumed;
    private boolean pending;
    private boolean scheduled;
    private boolean destroyed;

    RendererRecovery(long lastRecoveryAt, Consumer<Runnable> post, Runnable recreate) {
        this.lastRecoveryAt = lastRecoveryAt;
        this.post = post;
        this.recreate = recreate;
    }

    boolean onRendererGone(long now) {
        if (destroyed) return false;
        if (pending) return true;
        // A bundle that crashes during every boot must not cause a recreate loop.
        // Let Android terminate normally if the replacement renderer also dies.
        if (lastRecoveryAt >= 0 && now - lastRecoveryAt < RETRY_WINDOW_MS) return false;
        lastRecoveryAt = now;
        pending = true;
        scheduleIfReady();
        return true;
    }

    void onResume() {
        resumed = true;
        scheduleIfReady();
    }

    void onPause() {
        resumed = false;
    }

    void onDestroy() {
        destroyed = true;
    }

    boolean isPending() {
        return pending;
    }

    long getLastRecoveryAt() {
        return lastRecoveryAt;
    }

    private void scheduleIfReady() {
        if (!pending || !resumed || scheduled || destroyed) return;
        scheduled = true;
        // Leave the renderer callback before recreating. Recheck visibility in
        // case the user switches away again before this UI-thread task runs.
        post.accept(() -> {
            if (destroyed) return;
            if (!resumed) {
                scheduled = false;
                return;
            }
            recreate.run();
        });
    }
}
