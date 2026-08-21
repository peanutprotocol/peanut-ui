package me.peanut.wallet;

import android.app.Activity;
import android.content.Intent;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tapandpay.issuer.TokenInfo;
import com.google.android.gms.tapandpay.issuer.UserAddress;
import com.meawallet.mpp.GooglePayRegisteredTokensListener;
import com.meawallet.mpp.MeaPushProvisioning;
import com.meawallet.mpp.MppCardDataParameters;
import com.meawallet.mpp.MppError;
import com.meawallet.mpp.MppPaymentNetwork;
import com.meawallet.mpp.MppPushCardToGooglePayListener;

import java.util.List;

/**
 * Google Pay push provisioning via the MeaWallet MPP SDK. This file lives in
 * src/meawallet/java, which app/build.gradle adds to the source set only when
 * the MeaWallet Nexus credentials are present — builds without the SDK never
 * compile it, and MainActivity registers it via a reflection lookup that
 * tolerates its absence. The mea_config SDK config ships in res/raw (gitignored,
 * CI-injected); without it every method reports unavailable.
 */
@CapacitorPlugin(name = "PushProvisioning")
public class PushProvisioningPlugin extends Plugin {

    private static boolean initialize(android.content.Context context) {
        try {
            if (!MeaPushProvisioning.isInitialized()) {
                MeaPushProvisioning.initialize(context);
            }
            return true;
        } catch (Exception e) {
            // Missing/broken mea_config — treat as "SDK not in this build".
            return false;
        }
    }

    /** Called reflectively from MainActivity.onActivityResult — must not throw. */
    public static boolean handleGooglePayActivityResult(int requestCode, int resultCode, Intent data, Activity activity) {
        try {
            if (!MeaPushProvisioning.isInitialized()) return false;
            return MeaPushProvisioning.GooglePay.handleOnActivityResult(requestCode, resultCode, data, activity);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean hasMeaConfig() {
        return getContext().getResources().getIdentifier("mea_config", "raw", getContext().getPackageName()) != 0;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        if (!hasMeaConfig() || !initialize(getContext())) {
            JSObject out = new JSObject();
            out.put("available", false);
            out.put("alreadyInWallet", false);
            call.resolve(out);
            return;
        }
        String last4 = call.getString("last4", "");
        if (last4 == null || last4.isEmpty()) {
            JSObject out = new JSObject();
            out.put("available", true);
            out.put("alreadyInWallet", false);
            call.resolve(out);
            return;
        }
        MeaPushProvisioning.GooglePay.checkWalletForCardSuffix(last4, new GooglePayRegisteredTokensListener() {
            @Override
            public void onSuccess(@NonNull List<TokenInfo> tokens) {
                JSObject out = new JSObject();
                out.put("available", tokens.isEmpty());
                out.put("alreadyInWallet", !tokens.isEmpty());
                call.resolve(out);
            }

            @Override
            public void onFailure(@NonNull MppError error) {
                // Can't tell — let the button show; the push flow surfaces the
                // real error if the card is genuinely already tokenized.
                JSObject out = new JSObject();
                out.put("available", true);
                out.put("alreadyInWallet", false);
                call.resolve(out);
            }
        });
    }

    @PluginMethod
    public void addCard(PluginCall call) {
        String cardId = call.getString("cardId");
        String cardSecret = call.getString("cardSecret");
        if (cardId == null || cardSecret == null) {
            call.reject("cardId and cardSecret are required", "BAD_PARAMS");
            return;
        }
        if (!hasMeaConfig() || !initialize(getContext())) {
            call.reject("MeaWallet SDK unavailable in this build", "UNAVAILABLE");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No foreground activity", "UNAVAILABLE");
            return;
        }

        MppCardDataParameters cardParams = MppCardDataParameters.withCardSecret(cardId, cardSecret);
        String displayName = call.getString("displayName", "Peanut Card");
        UserAddress userAddress = buildUserAddress(call);

        // LEGACY flow on purpose: pushCard(...) is Google's TSP-only Push
        // Provisioning, push(...) (same signature) is Unified Push Provisioning.
        // Rain does not support UPP yet (docs.rain.xyz/docs/push-provisioning);
        // Google deprecates legacy end of 2026, so this becomes push(...) once
        // Rain confirms UPP support + the Google UPP onboarding is done.
        // Intermediate results come back through onActivityResult —
        // MainActivity forwards them to handleGooglePayActivityResult above.
        MeaPushProvisioning.GooglePay.pushCard(cardParams, displayName, userAddress, activity, new MppPushCardToGooglePayListener() {
            @Override
            public void onSuccess(String tokenReferenceId, String cardLastFourDigits, MppPaymentNetwork cardNetwork) {
                JSObject out = new JSObject();
                out.put("added", true);
                out.put("last4", cardLastFourDigits);
                call.resolve(out);
            }

            @Override
            public void onFailure(MppError error) {
                JSObject out = new JSObject();
                out.put("added", false);
                out.put("error", error != null ? error.getMessage() : "unknown");
                call.resolve(out);
            }
        });
    }

    /**
     * Billing address from the provisioning-data endpoint → Google's UserAddress.
     * Google uses it to prefill the tokenization sheet; incomplete fields are
     * tolerated here (the backend already refused cards with no billing at all).
     */
    private UserAddress buildUserAddress(PluginCall call) {
        JSObject addr = call.getObject("address", new JSObject());
        UserAddress.Builder builder = UserAddress.newBuilder();
        String name = call.getString("cardholderName", "");
        if (name != null && !name.isEmpty()) builder.setName(name);
        putIfPresent(addr, "line1", builder::setAddress1);
        putIfPresent(addr, "line2", builder::setAddress2);
        putIfPresent(addr, "city", builder::setLocality);
        putIfPresent(addr, "region", builder::setAdministrativeArea);
        putIfPresent(addr, "postalCode", builder::setPostalCode);
        putIfPresent(addr, "countryCode", builder::setCountryCode);
        return builder.build();
    }

    private interface Setter {
        void set(String value);
    }

    private static void putIfPresent(JSObject obj, String key, Setter setter) {
        String value = obj.getString(key, "");
        if (value != null && !value.isEmpty()) setter.set(value);
    }
}
