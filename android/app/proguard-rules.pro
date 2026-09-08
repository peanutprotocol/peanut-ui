# Capacitor's consumer rules preserve plugin entry points and annotated callbacks.
# MainActivity also calls this optional plugin's static handler through reflection.
-keep,allowoptimization class me.peanut.wallet.PushProvisioningPlugin {
    public <init>();
    public static boolean handleGooglePayActivityResult(int, int, android.content.Intent, android.app.Activity);
}
