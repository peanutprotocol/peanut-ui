package me.peanut.wallet;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;

/*
 * Launcher entry point (TASK-22030). MainActivity is singleTask so App Links
 * reuse the one WebView, but when a singleTask activity is also the launcher
 * target, tapping the app icon clears every activity stacked above it. That
 * destroyed the native Sumsub SDK (and the Custom Tab browser) mid-flow, and
 * the user lost everything they had typed. Resuming from recents never did
 * this, because recents only brings the task to the front.
 *
 * With this activity as the launcher target, the icon behaves like recents:
 * - app not running: forward to MainActivity and finish (cold start).
 * - app already running: this lands on top of the existing task, so just
 *   finish and reveal whatever the user left on screen.
 */
public class LauncherActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!isTaskRoot()) {
            finish();
            return;
        }
        // forward the launch intent's data and extras unchanged
        Intent intent = new Intent(getIntent());
        intent.setComponent(new ComponentName(this, MainActivity.class));
        startActivity(intent);
        finish();
    }
}
