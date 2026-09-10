# Capacitor 8.2.0's consumer rules preserve plugin entry points and callbacks,
# but R8 can still strip the nested permission metadata from @CapacitorPlugin.
# Bridge.getPermissionStates() reads that metadata at runtime; without it,
# release builds can crash with a NullPointerException before JS can recover.
# Keep both the runtime attributes and annotation definitions until Capacitor
# ships an upstream fix for https://github.com/ionic-team/capacitor/issues/8399.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keep @interface com.getcapacitor.annotation.CapacitorPlugin { *; }
-keep @interface com.getcapacitor.annotation.Permission { *; }

# MainActivity calls this optional plugin's static handler through reflection.
-keep,allowoptimization class me.peanut.wallet.PushProvisioningPlugin {
    public <init>();
    public static boolean handleGooglePayActivityResult(int, int, android.content.Intent, android.app.Activity);
}
