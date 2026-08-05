import Capacitor
import UIKit

// App-local plugins aren't auto-discovered; register them once the bridge is up.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ClipboardDetectPlugin())
    }
}
