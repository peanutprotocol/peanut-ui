package me.peanut.wallet;

import static org.junit.Assert.*;
import org.junit.Test;

public class RendererLossTest {
    @Test
    public void onlyANonCrashInBackgroundIsReclamation() {
        assertTrue(RendererLoss.isBackgroundReclamation(false, false));
        assertFalse(RendererLoss.isBackgroundReclamation(false, true));
        assertFalse(RendererLoss.isBackgroundReclamation(true, false));
        assertFalse(RendererLoss.isBackgroundReclamation(true, true));
    }
}
