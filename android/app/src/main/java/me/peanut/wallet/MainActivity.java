package me.peanut.wallet;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import io.sentry.Sentry;
import io.sentry.SentryLevel;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {
    private static final String RENDERER_RECOVERY_AT = "peanut.rendererRecoveryAt";
    private static final String RENDERER_RECOVERY_INTENT = "peanut.rendererRecoveryIntent";
    private RendererRecovery rendererRecovery;

    @Override
    public void onResume() {
        super.onResume();
        rendererRecovery.onResume();
    }

    @Override
    public void onPause() {
        rendererRecovery.onPause();
        super.onPause();
    }

    @Override
    public void onDestroy() {
        rendererRecovery.onDestroy();
        super.onDestroy();
    }

    @Override
    public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putLong(RENDERER_RECOVERY_AT, rendererRecovery.getLastRecoveryAt());
        // Activity recreation can restore the framework's original launch
        // Intent rather than the one assigned with setIntent(). Carry ours
        // explicitly so a consumed link stays consumed across the rebuild.
        if (rendererRecovery.isPending()) outState.putParcelable(RENDERER_RECOVERY_INTENT, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        // A new deep link received while waiting to rebuild must reach the new
        // bridge. Ordinary resumes must not replay the original launch link.
        if (rendererRecovery.isPending()) setIntent(intent);
        super.onNewIntent(intent);
    }

    private boolean recoverRenderer(WebView view, RenderProcessGoneDetail detail) {
        if (!rendererRecovery.onRendererGone(SystemClock.elapsedRealtime())) return false;
        if (bridge == null) return true;

        Sentry.captureMessage("Android WebView renderer " + (detail.didCrash() ? "crashed" : "was killed"), SentryLevel.WARNING);

        // The dead WebView cannot be reloaded. Tear down its plugins and detach
        // it, then let a fresh Activity build a fresh Capacitor bridge. Clearing
        // bridge first prevents resume/detach callbacks from using it again.
        Bridge deadBridge = bridge;
        bridge = null;
        setIntent(new Intent(this, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER));
        if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
        try {
            deadBridge.onDestroy();
        } finally {
            view.destroy();
        }
        return true;
    }

    /*
     * PushProvisioningPlugin compiles only when the MeaWallet Nexus credentials
     * were present at build time (src/meawallet/java, see app/build.gradle), so
     * both the registration and the Google Pay activity-result forward go
     * through reflection — a build without the SDK must run exactly as before.
     */
    private void registerPushProvisioningPlugin() {
        try {
            registerPlugin(Class.forName("me.peanut.wallet.PushProvisioningPlugin")
                    .asSubclass(com.getcapacitor.Plugin.class));
        } catch (Exception ignored) {}
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        try {
            Object handled = Class.forName("me.peanut.wallet.PushProvisioningPlugin")
                    .getMethod("handleGooglePayActivityResult", int.class, int.class, Intent.class, android.app.Activity.class)
                    .invoke(null, requestCode, resultCode, data, this);
            if (Boolean.TRUE.equals(handled)) return;
        } catch (Exception ignored) {}
        super.onActivityResult(requestCode, resultCode, data);
    }

    private void maybeSentryTestCrash() {
        if (getIntent() == null || !getIntent().getBooleanExtra("sentry_test_crash", false)) return;
        if (getReferrer() != null) return; // app-to-app starts always carry a referrer; adb doesn't
        boolean adbOn = Settings.Global.getInt(getContentResolver(), Settings.Global.ADB_ENABLED, 0) == 1
                || Settings.Global.getInt(getContentResolver(), "adb_wifi_enabled", 0) == 1;
        if (!adbOn) return;
        android.content.SharedPreferences prefs = getSharedPreferences("sentry_test_crash", MODE_PRIVATE);
        if (prefs.getBoolean("fired", false)) return; // one-shot: a redelivered intent can't crash-loop
        prefs.edit().putBoolean("fired", true).commit(); // sync commit — must persist before we die
        throw new RuntimeException("sentry native test crash (deliberate, adb-triggered)");
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        if (savedInstanceState != null) {
            Intent recoveryIntent = savedInstanceState.getParcelable(RENDERER_RECOVERY_INTENT);
            if (recoveryIntent != null) setIntent(recoveryIntent);
        }
        Handler mainHandler = new Handler(Looper.getMainLooper());
        rendererRecovery = new RendererRecovery(
                savedInstanceState == null ? -1 : savedInstanceState.getLong(RENDERER_RECOVERY_AT, -1),
                task -> mainHandler.post(task),
                () -> {
                    if (!isFinishing() && !isDestroyed()) recreate();
                });
        // app-local plugin, not auto-discovered — must register before super.onCreate
        registerPlugin(InstallReferrerPlugin.class);
        registerPushProvisioningPlugin();
        super.onCreate(savedInstanceState);

        /*
         * Sentry reconciliation hook (TASK-20964): deliberately crash the native
         * process to verify crash capture + crash-free-session accounting end to
         * end on a real device. Cold start only (singleTask routes a running app
         * through onNewIntent, where the extra is dropped) — so force-stop first:
         *   adb shell am force-stop me.peanut.wallet
         *   adb shell am start -n me.peanut.wallet/.MainActivity --ez sentry_test_crash true
         * One-shot per install (clear app data or reinstall to re-arm). Three
         * independent gates keep this adb-only: the extra, a null referrer (an
         * app-to-app start always carries android-app://<caller>; only a shell
         * launch is referrer-less), and developer adb actually enabled (usb or
         * wireless) — so a third-party app can't crash the wallet on a normal
         * user's phone, and a recents relaunch redelivering the stored intent
         * can't crash-loop.
         */
        maybeSentryTestCrash();

        Bridge bridge = this.getBridge();
        if (bridge != null) {
            WebView webView = bridge.getWebView();

            /*
             * Extends BridgeWebViewClient instead of wrapping it in a plain
             * WebViewClient: the wrapper forwarded only shouldInterceptRequest and
             * shouldOverrideUrlLoading, silently dropping the other six callbacks —
             * including the onPageStarted/Finished notifications Capacitor
             * plugins rely on. Renderer loss needs explicit recovery below:
             * Capacitor forwards it to listeners but does not rebuild the view.
             */
            webView.setWebViewClient(new BridgeWebViewClient(bridge) {
                @Override
                public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    // Preserve plugin diagnostics, but do not mistake a listener
                    // return value for rebuilding our Activity and dead bridge.
                    super.onRenderProcessGone(view, detail);
                    return recoverRenderer(view, detail);
                }

                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    WebResourceResponse response = super.shouldInterceptRequest(view, request);

                    if (response == null && "GET".equals(request.getMethod()) && isAppHost(request)) {
                        String path = request.getUrl().getPath();
                        if (path != null && !path.contains(".") && !path.startsWith("/_next/") && !path.startsWith("/_capacitor_")) {
                            response = findPageHtml(view, path);
                        }
                    }

                    return response;
                }

                /*
                 * The SPA fallback must only answer for the app's own origin.
                 * Without this gate every cross-origin GET with a dotless path —
                 * ipfs.io/ipfs/<CID> chain icons, any extensionless API URL —
                 * got index.html back as text/html, which is why Base, Mantle
                 * and Avalanche logos rendered as letter avatars natively.
                 */
                private boolean isAppHost(WebResourceRequest request) {
                    String host = request.getUrl().getHost();
                    if (host == null) return false;
                    Bridge activeBridge = getBridge();
                    String appHost = activeBridge != null ? activeBridge.getConfig().getHostname() : "localhost";
                    return host.equalsIgnoreCase(appHost);
                }

                /**
                 * finds the correct pre-rendered HTML for a given path.
                 *
                 * tries in order:
                 * 1. exact path (e.g., /home → public/home/index.html)
                 * 2. placeholder paths — replaces each segment with "_" from right to left
                 *    (e.g., /send/kushagra → public/send/_/index.html)
                 *    this matches our static export's placeholder pages for dynamic routes.
                 * 3. root index.html as last resort
                 */
                private WebResourceResponse findPageHtml(WebView view, String path) {
                    // 1. try exact path
                    try {
                        String cleanPath = path.endsWith("/") ? path : path + "/";
                        InputStream is = openAppContent(view, cleanPath);
                        return new WebResourceResponse("text/html", "UTF-8", is);
                    } catch (Exception ignored) {}

                    // 2. try replacing segments with "_" (placeholder for dynamic routes)
                    String[] segments = path.split("/");
                    if (segments.length > 1) {
                        for (int i = segments.length - 1; i >= 1; i--) {
                            String original = segments[i];
                            if (original.isEmpty()) continue;
                            segments[i] = "_";
                            String tryPath = String.join("/", segments);
                            if (!tryPath.endsWith("/")) tryPath += "/";
                            try {
                                InputStream is = openAppContent(view, tryPath);
                                return new WebResourceResponse("text/html", "UTF-8", is);
                            } catch (Exception ignored) {
                                segments[i] = original;
                            }
                        }
                    }

                    // 3. try progressively shorter parent paths
                    // e.g. /send/kushagra → try /send/index.html
                    // this serves the static parent page for dynamic sub-paths
                    String parentPath = path;
                    while (parentPath.contains("/")) {
                        parentPath = parentPath.substring(0, parentPath.lastIndexOf("/"));
                        if (parentPath.isEmpty()) break;
                        try {
                            InputStream is = openAppContent(view, parentPath + "/");
                            return new WebResourceResponse("text/html", "UTF-8", is);
                        } catch (Exception ignored) {}
                    }

                    // 4. root fallback
                    try {
                        InputStream is = openAppContent(view, "/");
                        return new WebResourceResponse("text/html", "UTF-8", is);
                    } catch (Exception ignored) {}

                    return null;
                }

                /**
                 * Opens the index.html for a directory-style path ("/setup/"),
                 * honoring an active OTA bundle. When CapacitorUpdater has
                 * pointed the server base path at an on-disk bundle, HTML must
                 * come from that bundle — the APK's assets are a stale export
                 * whose chunk references no longer exist, and serving them
                 * bricks navigation (stuck splash loop after logout). Only when
                 * no bundle is active (base path isn't a directory) do we read
                 * the bundled assets.
                 */
                private InputStream openAppContent(WebView view, String cleanPath) throws Exception {
                    String rel = (cleanPath.startsWith("/") ? cleanPath.substring(1) : cleanPath) + "index.html";
                    Bridge activeBridge = getBridge();
                    String basePath = activeBridge != null ? activeBridge.getServerBasePath() : null;
                    if (basePath != null && !basePath.isEmpty()) {
                        File base = new File(basePath);
                        if (base.isDirectory()) {
                            return new FileInputStream(new File(base, rel));
                        }
                    }
                    return view.getContext().getAssets().open("public/" + rel);
                }
            });
        }
    }
}
