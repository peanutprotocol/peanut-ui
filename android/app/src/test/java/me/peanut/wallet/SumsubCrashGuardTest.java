package me.peanut.wallet;

import static org.junit.Assert.*;

import com.sumsub.sns.core.data.model.SNSException;

import java.net.SocketException;

import org.junit.Test;

public class SumsubCrashGuardTest {
    private static final SNSException NETWORK = new SNSException.Network(new SocketException("Connection reset"));
    private static final SNSException API = new SNSException.Api("Service unavailable", 503, "corr-1", 503, "unavailable");

    @Test
    public void keepsTheAppAliveForSumsubRemoteFailuresOffTheMainThread() {
        assertTrue(SumsubCrashGuard.shouldKeepAlive(NETWORK, false));
        assertTrue(SumsubCrashGuard.shouldKeepAlive(API, false));
    }

    @Test
    public void aMainThreadFailureIsAlwaysFatal() {
        assertFalse(SumsubCrashGuard.shouldKeepAlive(NETWORK, true));
        assertFalse(SumsubCrashGuard.shouldKeepAlive(API, true));
    }

    @Test
    public void otherFailuresStayFatal() {
        assertFalse(SumsubCrashGuard.shouldKeepAlive(new SNSException.Unknown(new IllegalStateException()), false));
        assertFalse(SumsubCrashGuard.shouldKeepAlive(new SocketException("Connection reset"), false));
        assertFalse(SumsubCrashGuard.shouldKeepAlive(new RuntimeException(NETWORK), false));
    }
}
