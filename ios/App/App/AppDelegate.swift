import UIKit
import Capacitor
import Sentry

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Sentry native crash reporting — the iOS half of TASK-20964 (Android:
        // AndroidManifest.xml). Captures what the JS SDK inside the WKWebView can't:
        // process crashes, app hangs, Swift plugin exceptions, WebView content-process
        // kills — and tracks native sessions, which is what makes crash-free-session %
        // measurable per release. DSN comes from Info.plist `SentryDSN` <- $(SENTRY_DSN)
        // build setting, set in ios-release.yml; an empty DSN leaves the SDK off, so
        // local builds stay silent. Release defaults to bundleId@version+build, the
        // same shape Android reports (me.peanut.wallet@1.1.0+123).
        if let dsn = Bundle.main.object(forInfoDictionaryKey: "SentryDSN") as? String, !dsn.isEmpty {
            SentrySDK.start { options in
                options.dsn = dsn
                options.environment = "native"
            }
            // Reconciliation hook (mirror of MainActivity.maybeSentryTestCrash): only a
            // developer can pass launch arguments to an iOS app — Xcode scheme, or
            //   xcrun devicectl device process launch --device <udid> me.peanut.wallet -sentry_test_crash
            // — so this is unreachable for users and needs no one-shot guard.
            if ProcessInfo.processInfo.arguments.contains("-sentry_test_crash") {
                SentrySDK.crash()
            }
        } else {
            NSLog("SentryDSN not set — native crash reporting is DISABLED in this build. Fine locally; a release build without it ships blind.")
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
