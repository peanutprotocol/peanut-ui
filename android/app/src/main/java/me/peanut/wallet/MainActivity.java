package me.peanut.wallet;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge bridge = this.getBridge();
        if (bridge != null) {
            WebView webView = bridge.getWebView();
            final android.webkit.WebViewClient originalClient = webView.getWebViewClient();

            webView.setWebViewClient(new android.webkit.WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    WebResourceResponse response = originalClient.shouldInterceptRequest(view, request);

                    if (response == null && "GET".equals(request.getMethod())) {
                        String path = request.getUrl().getPath();
                        if (path != null && !path.contains(".") && !path.startsWith("/_next/") && !path.startsWith("/_capacitor_")) {
                            response = findPageHtml(view, path);
                        }
                    }

                    return response;
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return originalClient.shouldOverrideUrlLoading(view, request);
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
