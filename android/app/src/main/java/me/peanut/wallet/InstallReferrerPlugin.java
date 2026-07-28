package me.peanut.wallet;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * exposes the play install referrer to JS for deferred deep linking: the web
 * store-bounce appends ?referrer=<payload> to the play url, and after install
 * the JS side (src/utils/deferred-link.ts) reads it back here exactly once.
 * always resolves — {referrer: null} on any failure — so the JS restore path
 * can treat every outcome the same way.
 */
@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

    @PluginMethod
    public void getReferrer(PluginCall call) {
        final InstallReferrerClient client = InstallReferrerClient.newBuilder(getContext()).build();
        try {
            client.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int responseCode) {
                    JSObject ret = new JSObject();
                    try {
                        if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                            ret.put("referrer", client.getInstallReferrer().getInstallReferrer());
                        } else {
                            // SERVICE_UNAVAILABLE / FEATURE_NOT_SUPPORTED / DEVELOPER_ERROR
                            ret.put("referrer", (String) null);
                        }
                    } catch (Exception e) {
                        ret.put("referrer", (String) null);
                    } finally {
                        try {
                            client.endConnection();
                        } catch (Exception ignored) {}
                    }
                    call.resolve(ret);
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    // one-shot read; the JS consumed flag prevents retries
                }
            });
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("referrer", (String) null);
            call.resolve(ret);
        }
    }
}
