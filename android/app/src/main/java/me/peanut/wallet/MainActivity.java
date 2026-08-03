package me.peanut.wallet;

import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // app-local plugin, not auto-discovered — must register before super.onCreate
        registerPlugin(InstallReferrerPlugin.class);
        super.onCreate(savedInstanceState);

        /*
         * Sentry reconciliation hook (TASK-20964): deliberately crash the native
         * process to verify crash capture + crash-free-session accounting end to
         * end on a real device. adb-only:
         *   adb shell am start -n me.peanut.wallet/.MainActivity --ez sentry_test_crash true
         * Gated on debug builds or usb-debugging-enabled devices so a third-party
         * app firing this intent extra can't crash the app on a normal user's phone.
         */
        if (getIntent() != null && getIntent().getBooleanExtra("sentry_test_crash", false)) {
            // triggering via adb implies usb debugging is on, so this gate costs
            // nothing for the intended use while blocking third-party apps from
            // crashing the app on a normal user's phone (adb off).
            boolean adbEnabled = Settings.Global.getInt(
                    getContentResolver(), Settings.Global.ADB_ENABLED, 0) == 1;
            if (adbEnabled) {
                throw new RuntimeException("sentry native test crash (deliberate, adb-triggered)");
            }
        }

        Bridge bridge = this.getBridge();
        if (bridge != null) {
            WebView webView = bridge.getWebView();

            /*
             * Extends BridgeWebViewClient instead of wrapping it in a plain
             * WebViewClient: the wrapper forwarded only shouldInterceptRequest and
             * shouldOverrideUrlLoading, silently dropping the other six callbacks —
             * most critically onRenderProcessGone (a WebView renderer crash killed
             * the app instead of recovering) and the onPageStarted/Finished
             * notifications Capacitor plugins rely on.
             */
            webView.setWebViewClient(new BridgeWebViewClient(bridge) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    WebResourceResponse response = super.shouldInterceptRequest(view, request);

                    if (response == null && "GET".equals(request.getMethod())) {
                        String path = request.getUrl().getPath();
                        if (path != null && !path.contains(".") && !path.startsWith("/_next/") && !path.startsWith("/_capacitor_")) {
                            response = findPageHtml(view, path);
                        }
                    }

                    return response;
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
