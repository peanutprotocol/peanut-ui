import Capacitor
import UIKit

/// The authenticated file stays local; only the chosen share target receives it.
@objc(ReceiptSharePlugin)
public class ReceiptSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReceiptSharePlugin"
    public let jsName = "ReceiptShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sharePdf", returnType: CAPPluginReturnPromise)
    ]

    @objc func sharePdf(_ call: CAPPluginCall) {
        guard let encoded = call.getString("data"), encoded.count <= 12 * 1024 * 1024,
              let data = Data(base64Encoded: encoded) else {
            call.reject("Invalid receipt data")
            return
        }
        do {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let requested = call.getString("filename") ?? "peanut-receipt.pdf"
            let name = URL(fileURLWithPath: requested).lastPathComponent
            let file = directory.appendingPathComponent(name.hasSuffix(".pdf") ? name : name + ".pdf")
            try data.write(to: file, options: .atomic)
            DispatchQueue.main.async {
                guard let controller = self.bridge?.viewController, controller.presentedViewController == nil else {
                    try? FileManager.default.removeItem(at: directory)
                    call.reject("Unable to present receipt sharing")
                    return
                }
                let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                sheet.setValue(call.getString("title"), forKey: "subject")
                // A source is required on iPad even when opened from a WebView button.
                sheet.popoverPresentationController?.sourceView = controller.view
                sheet.popoverPresentationController?.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.midY, width: 1, height: 1)
                sheet.completionWithItemsHandler = { _, completed, _, error in
                    try? FileManager.default.removeItem(at: directory)
                    if let error = error { call.reject("Unable to share receipt", nil, error) }
                    else { call.resolve(["cancelled": !completed]) }
                }
                controller.present(sheet, animated: true)
            }
        } catch {
            call.reject("Unable to prepare receipt", nil, error)
        }
    }
}
