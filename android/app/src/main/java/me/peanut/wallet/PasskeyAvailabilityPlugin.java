package me.peanut.wallet;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import androidx.annotation.RequiresApi;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetPublicKeyCredentialOption;
import androidx.credentials.PrepareGetCredentialResponse;
import androidx.credentials.PublicKeyCredential;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.SecureRandom;

@CapacitorPlugin(name = "PasskeyAvailability")
public class PasskeyAvailabilityPlugin extends Plugin {
    private static final long CHECK_TIMEOUT_MS = 5_000;

    @PluginMethod
    public void check(PluginCall call) {
        String rpId = call.getString("rpId");
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                || rpId == null || rpId.isEmpty() || rpId.length() > 253) {
            resolve(call, "unknown");
            return;
        }
        Handler main = new Handler(Looper.getMainLooper());
        main.post(() -> checkCandidates(call, rpId, main));
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private void checkCandidates(PluginCall call, String rpId, Handler main) {
        if (getContext().checkSelfPermission(Manifest.permission.CREDENTIAL_MANAGER_QUERY_CANDIDATE_CREDENTIALS)
                != PackageManager.PERMISSION_GRANTED) {
            resolve(call, "unknown");
            return;
        }
        CancellationSignal cancellation = new CancellationSignal();
        Runnable timeout = () -> {
            cancellation.cancel();
            resolve(call, "unknown");
        };
        main.postDelayed(timeout, CHECK_TIMEOUT_MS);
        try {
            // This challenge is only used to prepare candidates. The pending handle is never used.
            byte[] challenge = new byte[32];
            new SecureRandom().nextBytes(challenge);
            JSObject options = new JSObject()
                    .put("rpId", rpId)
                    .put("challenge", Base64.encodeToString(challenge, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING))
                    .put("userVerification", "preferred");
            GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(new GetPublicKeyCredentialOption(options.toString()))
                    .setPreferImmediatelyAvailableCredentials(true)
                    .build();
            CredentialManager.create(getContext()).prepareGetCredentialAsync(
                    request, cancellation, main::post,
                    new CredentialManagerCallback<PrepareGetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(PrepareGetCredentialResponse response) {
                            if (cancellation.isCanceled()) return;
                            main.removeCallbacks(timeout);
                            String availability = "unknown";
                            try {
                                // A failed provider can look exactly like an empty candidate list.
                                if (response.hasCredentialResults(PublicKeyCredential.TYPE_PUBLIC_KEY_CREDENTIAL)) {
                                    availability = "available";
                                } else if (!response.hasAuthenticationResults() && !response.hasRemoteResults()) {
                                    availability = "unavailable";
                                }
                            } catch (RuntimeException ignored) {
                                // A candidate query error leaves availability unknown.
                            } finally {
                                // Release the prepared session, since we never use its pending handle.
                                cancellation.cancel();
                            }
                            resolve(call, availability);
                        }

                        @Override
                        public void onError(GetCredentialException error) {
                            if (cancellation.isCanceled()) return;
                            main.removeCallbacks(timeout);
                            resolve(call, error instanceof NoCredentialException ? "unavailable" : "unknown");
                        }
                    });
        } catch (RuntimeException ignored) {
            main.removeCallbacks(timeout);
            if (!cancellation.isCanceled()) resolve(call, "unknown");
        }
    }

    private static void resolve(PluginCall call, String availability) {
        call.resolve(new JSObject().put("availability", availability));
    }
}
