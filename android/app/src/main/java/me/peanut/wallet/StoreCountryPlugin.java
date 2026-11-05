package me.peanut.wallet;

import android.os.Handler;
import android.os.Looper;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.GetBillingConfigParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayDeque;

/** A fresh Play-country query; no purchase flow, account identifiers, or storage. */
@CapacitorPlugin(name = "StoreCountry")
public class StoreCountryPlugin extends Plugin {
    private static final long TIMEOUT_MS = 5000;
    private final Handler main = new Handler(Looper.getMainLooper());
    // All request state and callbacks are confined to the main thread.
    private Request active;
    private final ArrayDeque<Request> pending = new ArrayDeque<>();
    private boolean destroyed;

    @PluginMethod
    public void getCurrent(PluginCall call) {
        main.post(() -> {
            if (destroyed) {
                resolve(call, null);
                return;
            }
            // Only one BillingClient connection at a time. Each decision gets
            // its own fresh query, including a foreground refresh during a read.
            Request request = new Request(call);
            main.postDelayed(request.timeout, TIMEOUT_MS);
            if (active != null) {
                pending.add(request);
                return;
            }
            active = request;
            request.start();
        });
    }

    @Override
    protected void handleOnDestroy() {
        main.post(() -> {
            destroyed = true;
            if (active != null) active.finish(null);
            while (!pending.isEmpty()) pending.remove().finish(null);
        });
        super.handleOnDestroy();
    }

    private static void resolve(PluginCall call, String countryCode) {
        JSObject result = new JSObject();
        result.put("countryCode", countryCode == null ? JSONObject.NULL : countryCode);
        call.resolve(result);
    }

    private final class Request {
        private final PluginCall call;
        private final Runnable timeout = () -> finish(null);
        private BillingClient client;
        private boolean completed;

        Request(PluginCall call) { this.call = call; }

        void start() {
            try {
                client = BillingClient.newBuilder(getContext())
                        .setListener((result, purchases) -> {})
                        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                        .build();
                client.startConnection(new BillingClientStateListener() {
                    @Override
                    public void onBillingSetupFinished(BillingResult result) {
                        main.post(() -> {
                            if (completed) return;
                            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                                finish(null);
                                return;
                            }
                            try {
                                client.getBillingConfigAsync(GetBillingConfigParams.newBuilder().build(),
                                        (configResult, config) -> main.post(() -> finish(
                                                configResult.getResponseCode() == BillingClient.BillingResponseCode.OK
                                                        && config != null ? config.getCountryCode() : null)));
                            } catch (Exception ignored) {
                                finish(null);
                            }
                        });
                    }

                    @Override
                    public void onBillingServiceDisconnected() {
                        main.post(() -> finish(null));
                    }
                });
            } catch (Exception ignored) {
                finish(null);
            }
        }

        void finish(String countryCode) {
            if (completed) return;
            completed = true;
            main.removeCallbacks(timeout);
            if (client != null) {
                try { client.endConnection(); } catch (Exception ignored) {}
            }
            pending.remove(this);
            boolean wasActive = active == this;
            if (wasActive) active = null;
            resolve(call, countryCode);
            if (wasActive && !destroyed && !pending.isEmpty()) {
                active = pending.remove();
                active.start();
            }
        }
    }
}
