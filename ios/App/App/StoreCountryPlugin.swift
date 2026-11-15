import Capacitor
import StoreKit

/// Current commerce region only. Never cache or save it with customer data.
@objc(StoreCountryPlugin)
public class StoreCountryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreCountryPlugin"
    public let jsName = "StoreCountry"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getCurrent", returnType: CAPPluginReturnPromise)
    ]

    @objc func getCurrent(_ call: CAPPluginCall) {
        Task { @MainActor in
            StoreCountryRequest(call).start()
        }
    }
}

/// Bound the native call as well as the JS wait; late replies cannot resolve twice.
@MainActor
private final class StoreCountryRequest {
    private let call: CAPPluginCall
    private var completed = false
    private var lookup: Task<Void, Never>?
    private var timeout: Task<Void, Never>?

    init(_ call: CAPPluginCall) { self.call = call }

    func start() {
        timeout = Task {
            do { try await Task.sleep(nanoseconds: 5_000_000_000) }
            catch { return }
            finish(nil)
        }
        lookup = Task {
            let storefront = await Storefront.current
            guard !Task.isCancelled else { return }
            finish(storefront?.countryCode)
        }
    }

    private func finish(_ countryCode: String?) {
        guard !completed else { return }
        completed = true
        lookup?.cancel()
        timeout?.cancel()
        lookup = nil
        timeout = nil
        call.resolve(["countryCode": countryCode.map { $0 as Any } ?? NSNull()])
    }
}
