package me.peanut.wallet;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

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
                        InputStream is = view.getContext().getAssets().open("public" + cleanPath + "index.html");
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
                                InputStream is = view.getContext().getAssets().open("public" + tryPath + "index.html");
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
                            InputStream is = view.getContext().getAssets().open("public" + parentPath + "/index.html");
                            return new WebResourceResponse("text/html", "UTF-8", is);
                        } catch (Exception ignored) {}
                    }

                    // 4. root fallback
                    try {
                        InputStream is = view.getContext().getAssets().open("public/index.html");
                        return new WebResourceResponse("text/html", "UTF-8", is);
                    } catch (Exception ignored) {}

                    return null;
                }
            });
        }
    }
}
