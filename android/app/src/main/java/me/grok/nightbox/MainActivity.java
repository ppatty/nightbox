package me.grok.nightbox;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String HOME_URL = "https://nightbox.grok.me";
    private static final String HOME_HOST = "nightbox.grok.me";
    private static final int FILE_CHOOSER_REQUEST = 71;
    private static final int BACKGROUND = Color.rgb(16, 14, 12);
    private static final int FOREGROUND = Color.rgb(244, 239, 230);
    private static final int MUTED = Color.rgb(174, 164, 151);

    private WebView webView;
    private View loadingPanel;
    private ValueCallback<Uri[]> pendingFileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(BACKGROUND);
        window.setNavigationBarColor(BACKGROUND);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);

        webView = new WebView(this);
        webView.setBackgroundColor(BACKGROUND);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if ("https".equalsIgnoreCase(scheme) && HOME_HOST.equalsIgnoreCase(host)) {
                    return false;
                }
                if ("https".equalsIgnoreCase(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                        showOffline();
                    }
                }
                return true;
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                loadingPanel.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(
                    WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (ActivityNotFoundException error) {
                    pendingFileCallback = null;
                    filePathCallback.onReceiveValue(null);
                    showOffline();
                }
                return true;
            }
        });

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        loadingPanel = createLoadingPanel();
        root.addView(loadingPanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        webView.loadUrl(HOME_URL);
    }

    private View createLoadingPanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setGravity(Gravity.CENTER);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(32), dp(24), dp(32), dp(24));
        panel.setBackgroundColor(BACKGROUND);

        TextView title = new TextView(this);
        title.setText("Nightbox");
        title.setTextColor(FOREGROUND);
        title.setTextSize(32);
        title.setGravity(Gravity.CENTER);
        panel.addView(title, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView message = new TextView(this);
        message.setText("Your private video shelf");
        message.setTextColor(MUTED);
        message.setTextSize(16);
        message.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        messageParams.topMargin = dp(8);
        panel.addView(message, messageParams);

        Button retry = new Button(this);
        retry.setText("Try again");
        retry.setOnClickListener(view -> {
            loadingPanel.setVisibility(View.VISIBLE);
            webView.loadUrl(HOME_URL);
        });
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        retryParams.topMargin = dp(24);
        panel.addView(retry, retryParams);
        return panel;
    }

    private void showOffline() {
        if (loadingPanel != null) loadingPanel.setVisibility(View.VISIBLE);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST) return;
        if (pendingFileCallback == null) return;
        Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        pendingFileCallback.onReceiveValue(results);
        pendingFileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (pendingFileCallback != null) {
            pendingFileCallback.onReceiveValue(null);
            pendingFileCallback = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
