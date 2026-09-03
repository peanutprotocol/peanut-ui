package me.peanut.wallet;

import android.app.Activity;
import android.content.Intent;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tapandpay.TapAndPay;
import com.google.android.gms.tapandpay.issuer.TokenInfo;
import com.google.android.gms.tapandpay.issuer.UserAddress;
import com.meawallet.mpp.GooglePayRegisteredTokensListener;
import com.meawallet.mpp.GooglePayTokenInfo;
import com.meawallet.mpp.GooglePayTokenListener;
import com.meawallet.mpp.GooglePayTokenizeListener;
import com.meawallet.mpp.MeaPushProvisioning;
import com.meawallet.mpp.MppCardDataParameters;
import com.meawallet.mpp.MppError;
import com.meawallet.mpp.MppErrorCode;
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
        // Without Google Wallet installed the suffix lookup finds no token and
        // reports the card as addable, so the UI would swap the manual flow for
        // a one-tap action that fetches PAN-equivalent credentials and can only
        // fail. Rule it out before the lookup.
        if (!hasMeaConfig() || !initialize(getContext()) || !MeaPushProvisioning.GooglePay.isWalletAvailable(getContext())) {
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
                boolean provisioned = false;
                for (TokenInfo token : tokens) {
                    if (isProvisioned(token.getTokenState())) {
                        provisioned = true;
                        break;
                    }
                }
                JSObject out = new JSObject();
                out.put("available", !provisioned);
                out.put("alreadyInWallet", provisioned);
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

    /**
     * Only a token Google has finished provisioning counts as "already added".
     * checkWalletForCardSuffix also returns tokens in the yellow path
     * (TOKEN_STATE_NEEDS_IDENTITY_VERIFICATION) and ones still pending: those
     * are registered to the wallet but unusable, and addCard resumes them via
     * tokenize(), so the native row has to stay reachable for them.
     */
    private static boolean isProvisioned(int tokenState) {
        return tokenState == TapAndPay.TOKEN_STATE_ACTIVE || tokenState == TapAndPay.TOKEN_STATE_SUSPENDED;
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

        // A token the wallet already holds cannot be pushed again: pushCard on a
        // yellow-path token fails instead of resuming it, which is the only way
        // the user can finish identity verification. Look the token up first and
        // branch; anything we can't classify falls through to the normal push, so
        // a lookup failure is never worse than not looking.
        MeaPushProvisioning.GooglePay.checkWalletForCardToken(cardParams, new GooglePayTokenListener() {
            @Override
            public void onSuccess(@NonNull GooglePayTokenInfo token) {
                switch (token.getTokenState()) {
                    case TOKEN_STATE_NEEDS_IDENTITY_VERIFICATION:
                    case TOKEN_STATE_PENDING:
                    case TOKEN_STATE_FELICA_PENDING_PROVISIONING:
                        resumeTokenization(call, token, displayName, activity);
                        return;
                    case TOKEN_STATE_ACTIVE:
                    case TOKEN_STATE_SUSPENDED: {
                        JSObject out = new JSObject();
                        out.put("added", false);
                        out.put("alreadyInWallet", true);
                        call.resolve(out);
                        return;
                    }
                    default:
                        pushNewCard(call, cardParams, displayName, userAddress, activity);
                }
            }

            @Override
            public void onFailure(@NonNull MppError error) {
                pushNewCard(call, cardParams, displayName, userAddress, activity);
            }
        });
    }

    /** Yellow path: the token exists but Google still needs the ID&V challenge. */
    private static void resumeTokenization(PluginCall call, GooglePayTokenInfo token, String displayName, Activity activity) {
        MeaPushProvisioning.GooglePay.tokenize(token, displayName, activity, new GooglePayTokenizeListener() {
            @Override
            public void onSuccess() {
                JSObject out = new JSObject();
                out.put("added", true);
                call.resolve(out);
            }

            @Override
            public void onFailure(@NonNull MppError error) {
                call.resolve(failure(error));
            }
        });
    }

    private static void pushNewCard(PluginCall call, MppCardDataParameters cardParams, String displayName, UserAddress userAddress, Activity activity) {
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
                call.resolve(failure(error));
            }
        });
    }

    /**
     * Closing the Google Pay sheet arrives as a failure, not a distinct callback.
     * The JS layer has a quiet canceled path — without this it would report a
     * failed provisioning and show the red toast for a deliberate dismissal.
     */
    private static JSObject failure(MppError error) {
        JSObject out = new JSObject();
        out.put("added", false);
        if (error != null && error.getCode() == MppErrorCode.OPERATION_CANCELLED_BY_USER) {
            out.put("canceled", true);
            return out;
        }
        out.put("error", error != null ? error.getMessage() : "unknown");
        return out;
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
