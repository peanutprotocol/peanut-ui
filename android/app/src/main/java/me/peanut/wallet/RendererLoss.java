package me.peanut.wallet;

/** Keep an OS background reclamation distinct from a user-visible renderer failure. */
final class RendererLoss {
    static boolean isBackgroundReclamation(boolean didCrash, boolean foreground) {
        return !didCrash && !foreground;
    }
}
