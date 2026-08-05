import Capacitor
import UIKit

/*
 * Prompt-free clipboard presence check. UIPasteboard.hasStrings is metadata
 * only, so it never raises the iOS 16+ "Allow Paste" alert — unlike a real
 * Clipboard.read(), whose un-gestured use raced (and blocked) the camera
 * permission dialog in the QR scanner. Content is still read exclusively via
 * @capacitor/clipboard on a user gesture.
 */
@objc(ClipboardDetectPlugin)
public class ClipboardDetectPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClipboardDetectPlugin"
    public let jsName = "ClipboardDetect"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "hasStrings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasProbableWebUrl", returnType: CAPPluginReturnPromise)
    ]

    @objc func hasStrings(_ call: CAPPluginCall) {
        call.resolve(["value": UIPasteboard.general.hasStrings])
    }

    /*
     * detectPatterns is also prompt-free: it reports pattern confidence
     * without exposing content. Gates the deferred-deep-link clipboard read
     * so only a probable web URL (the hand-off shape) triggers the real,
     * prompt-raising read.
     */
    @objc func hasProbableWebUrl(_ call: CAPPluginCall) {
        UIPasteboard.general.detectPatterns(for: [\.probableWebURL]) { result in
            switch result {
            case .success(let patterns):
                call.resolve(["value": patterns.contains(\.probableWebURL)])
            case .failure:
                call.resolve(["value": false])
            }
        }
    }
}
