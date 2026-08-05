package me.peanut.wallet;

import android.os.Handler;
import android.os.Looper;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * exposes the play install referrer to JS for deferred deep linking: the web
 * store-bounce appends ?referrer=<payload> to the play url, and after install
 * the JS side (src/utils/deferred-link.ts) reads it back here exactly once.
 * always resolves — {referrer: null} on any failure or after a 5s timeout
 * (the referrer service can bind without ever calling back, and the JS side
 * awaits this before finishing app init) — so the promise can never hang.
 */
@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

    private static final long TIMEOUT_MS = 5000;

    @PluginMethod
    public void getReferrer(PluginCall call) {
        final InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        final AtomicBoolean resolved = new AtomicBoolean(false);
        final Handler timeoutHandler = new Handler(Looper.getMainLooper());
        final Runnable timeout = () -> resolveOnce(call, client, resolved, null);
        timeoutHandler.postDelayed(timeout, TIMEOUT_MS);

        try {
            client.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int responseCode) {
                    timeoutHandler.removeCallbacks(timeout);
                    String referrer = null;
                    try {
                        if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                            referrer = client.getInstallReferrer().getInstallReferrer();
                        }
                        // else: SERVICE_UNAVAILABLE / FEATURE_NOT_SUPPORTED / DEVELOPER_ERROR
                    } catch (Exception ignored) {}
                    resolveOnce(call, client, resolved, referrer);
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    // one-shot read; resolve null instead of leaving the call pending
                    timeoutHandler.removeCallbacks(timeout);
                    resolveOnce(call, client, resolved, null);
                }
            });
        } catch (Exception e) {
            timeoutHandler.removeCallbacks(timeout);
            resolveOnce(call, client, resolved, null);
        }
    }

    private void resolveOnce(PluginCall call, InstallReferrerClient client, AtomicBoolean resolved, String referrer) {
        if (!resolved.compareAndSet(false, true)) return;
        try {
            client.endConnection();
        } catch (Exception ignored) {}
        JSObject ret = new JSObject();
        ret.put("referrer", referrer);
        call.resolve(ret);
    }
}
