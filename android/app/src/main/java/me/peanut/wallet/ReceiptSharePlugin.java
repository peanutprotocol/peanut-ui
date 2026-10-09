package me.peanut.wallet;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.util.UUID;

/** Shares already-authenticated PDF bytes via a temporary read-only content URI. */
@CapacitorPlugin(name = "ReceiptShare")
public class ReceiptSharePlugin extends Plugin {
    @PluginMethod
    public void sharePdf(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.length() > 12 * 1024 * 1024) {
            call.reject("Invalid receipt data");
            return;
        }
        try {
            File cache = new File(getContext().getCacheDir(), "receipts");
            if (!cache.exists() && !cache.mkdirs()) throw new Exception("Unable to prepare receipt");
            // Targets can read after the chooser returns. Keep the current file;
            // expire older shares on the next use instead of revoking them early.
            File[] previous = cache.listFiles();
            if (previous != null) for (File directory : previous) {
                if (directory.lastModified() < System.currentTimeMillis() - 24 * 60 * 60 * 1000L) {
                    File[] files = directory.listFiles();
                    if (files != null) for (File file : files) file.delete();
                    directory.delete();
                }
            }
            File directory = new File(cache, UUID.randomUUID().toString());
            if (!directory.mkdir()) throw new Exception("Unable to prepare receipt");
            String filename = call.getString("filename", "peanut-receipt.pdf").replaceAll("[^a-zA-Z0-9._-]", "_");
            if (!filename.endsWith(".pdf")) filename += ".pdf";
            File pdf = new File(directory, filename);
            try (FileOutputStream output = new FileOutputStream(pdf)) {
                output.write(Base64.decode(data, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", pdf);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/pdf");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.putExtra(Intent.EXTRA_SUBJECT, call.getString("title"));
            intent.setClipData(ClipData.newRawUri("receipt", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(() -> {
                try {
                    startActivityForResult(call, Intent.createChooser(intent, call.getString("title")), "shareFinished");
                } catch (Exception error) {
                    call.reject("Unable to open receipt sharing", error);
                }
            });
        } catch (Exception error) {
            call.reject("Unable to share receipt", error);
        }
    }

    @ActivityCallback
    private void shareFinished(PluginCall call, ActivityResult result) {
        // Android does not reliably report whether the target actually sent it.
        if (call != null) call.resolve();
    }
}
