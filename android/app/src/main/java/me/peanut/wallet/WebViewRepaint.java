package me.peanut.wallet;

import java.util.function.Consumer;

/** Redraw a live page only after both Activity resume and window focus. */
final class WebViewRepaint {
    private final Consumer<Runnable> post;
    private final Runnable repaint;
    private boolean resumed;
    private boolean focused;
    private boolean pending;
    private boolean destroyed;
    private long generation;
    private long scheduledGeneration = -1;

    WebViewRepaint(Consumer<Runnable> post, Runnable repaint) {
        this.post = post;
        this.repaint = repaint;
    }

    void onResume(boolean hasWindowFocus) {
        resumed = true;
        focused = hasWindowFocus;
        schedule();
    }

    void onPause() {
        resumed = false;
        focused = false;
        pending = true;
        generation++;
    }

    void onWindowFocusChanged(boolean hasFocus) {
        focused = hasFocus;
        if (!hasFocus) {
            pending = true;
            generation++;
        }
        schedule();
    }

    void onDestroy() {
        destroyed = true;
        generation++;
    }

    boolean isActive() {
        return resumed && focused && !destroyed;
    }

    private void schedule() {
        if (!pending || !isActive() || scheduledGeneration == generation) return;
        long requestedGeneration = generation;
        scheduledGeneration = requestedGeneration;
        // A lock screen can take focus back before the next frame. An old
        // callback must neither paint behind it nor consume a later wake.
        post.accept(() -> {
            if (generation != requestedGeneration || !isActive()) return;
            pending = false;
            repaint.run();
        });
    }
}
