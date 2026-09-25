package com.siya.mobile;

import android.content.res.AssetManager;
import android.util.Log;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * A minimal static file server bound to 127.0.0.1, serving the bundled web
 * app straight out of the APK's assets/www/ folder. Chromium (and Android's
 * WebView) treats http://127.0.0.1 as a secure context, which is what lets
 * getUserMedia (the mic) work -- a plain file:// origin does not reliably
 * get that treatment. This keeps Siya fully on-device: no laptop, no adb
 * reverse tunnel, nothing but this process serving its own bundle to itself.
 */
final class AssetServer implements Runnable {
    private static final String TAG = "SiyaAssetServer";

    private final AssetManager assets;
    private final String assetsRoot;
    private final int port;
    private volatile boolean running = true;
    private ServerSocket serverSocket;

    AssetServer(AssetManager assets, String assetsRoot, int port) {
        this.assets = assets;
        this.assetsRoot = assetsRoot;
        this.port = port;
    }

    void stop() {
        running = false;
        if (serverSocket != null) {
            try {
                serverSocket.close();
            } catch (IOException ignored) {
            }
        }
    }

    @Override
    public void run() {
        try {
            serverSocket = new ServerSocket(port, 50, InetAddress.getByName("127.0.0.1"));
            while (running) {
                final Socket client = serverSocket.accept();
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        handle(client);
                    }
                }).start();
            }
        } catch (IOException e) {
            if (running) Log.e(TAG, "Server loop failed", e);
        }
    }

    private void handle(Socket client) {
        try (Socket socket = client) {
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
            String requestLine = reader.readLine();
            if (requestLine == null) return;
            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;
            String path = parts[1];
            int query = path.indexOf('?');
            if (query >= 0) path = path.substring(0, query);
            if (path.equals("/")) path = "/index.html";
            String assetPath = assetsRoot + path;

            OutputStream out = socket.getOutputStream();
            try (InputStream in = assets.open(assetPath)) {
                byte[] body = readAll(in);
                writeResponse(out, 200, "OK", contentType(assetPath), body);
            } catch (IOException notFound) {
                byte[] body = "404 not found".getBytes(StandardCharsets.UTF_8);
                writeResponse(out, 404, "Not Found", "text/plain; charset=utf-8", body);
            }
        } catch (IOException e) {
            Log.w(TAG, "Request handling failed", e);
        }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
        byte[] chunk = new byte[16384];
        int read;
        while ((read = in.read(chunk)) != -1) buffer.write(chunk, 0, read);
        return buffer.toByteArray();
    }

    private static void writeResponse(OutputStream out, int status, String statusText, String contentType, byte[] body) throws IOException {
        String headers = "HTTP/1.1 " + status + " " + statusText + "\r\n"
            + "Content-Type: " + contentType + "\r\n"
            + "Content-Length: " + body.length + "\r\n"
            + "Cache-Control: no-cache\r\n"
            + "Connection: close\r\n\r\n";
        out.write(headers.getBytes(StandardCharsets.US_ASCII));
        out.write(body);
        out.flush();
    }

    private static String contentType(String path) {
        String lower = path.toLowerCase(java.util.Locale.US);
        if (lower.endsWith(".html")) return "text/html; charset=utf-8";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (lower.endsWith(".css")) return "text/css; charset=utf-8";
        if (lower.endsWith(".json")) return "application/json; charset=utf-8";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".pmx") || lower.endsWith(".wasm")) return "application/octet-stream";
        return "application/octet-stream";
    }
}
