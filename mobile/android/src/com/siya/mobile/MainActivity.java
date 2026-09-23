package com.siya.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Siya, standalone: this app bundles the whole web UI in assets/www/ and
 * serves it to itself over 127.0.0.1 (see AssetServer) so the WebView gets a
 * secure-context origin the mic API will actually work on. The page talks
 * directly to Gemini's Live API from there -- no computer, no USB, no adb
 * reverse tunnel involved after install.
 */
public final class MainActivity extends Activity {
    private static final int LOCAL_PORT = 8973;
    private static final String SIYA_URL = "http://127.0.0.1:" + LOCAL_PORT;
    private static final int MEDIA_PERMISSIONS = 1001;
    private WebView webView;
    private AssetServer assetServer;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        AudioManager audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audio != null) {
            audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audio.setSpeakerphoneOn(true);
        }

        assetServer = new AssetServer(getAssets(), "www", LOCAL_PORT);
        new Thread(assetServer).start();

        WebView.setWebContentsDebuggingEnabled(true);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 5, 9));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setUserAgentString(settings.getUserAgentString() + " SiyaMobile/1.0");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("127.0.0.1".equals(uri.getHost())) return false;
                startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, uri));
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        String[] requested = request.getResources();
                        java.util.ArrayList<String> granted = new java.util.ArrayList<String>();
                        for (String resource : requested) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) &&
                                    checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                granted.add(resource);
                            } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) &&
                                    checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                granted.add(resource);
                            }
                        }
                        if (granted.size() == requested.length) request.grant(granted.toArray(new String[0]));
                        else request.deny();
                    }
                });
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d("SiyaWebConsole", cm.message() + " [" + cm.sourceId() + ":" + cm.lineNumber() + "]");
                return true;
            }
        });

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA}, MEDIA_PERMISSIONS);
        }
        webView.loadUrl(SIYA_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        if (assetServer != null) assetServer.stop();
        super.onDestroy();
    }
}
