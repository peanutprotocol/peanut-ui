import Foundation
#if canImport(MeaPushProvisioning)
import MeaPushProvisioning
#endif

#if canImport(MeaPushProvisioning)
/**
 * MPP initialization is intentionally kept in memory between passEntries and
 * generateAddPaymentPassRequest. The receipt is a one-time handoff and must
 * not be persisted in UserDefaults or the keychain.
 */
enum WalletProvisioningSession {
    private static var values: [String: MppInitializeOemTokenizationResponseData] = [:]
    private static let lock = NSLock()

    static func store(_ value: MppInitializeOemTokenizationResponseData, for identifier: String) {
        lock.lock()
        values[identifier] = value
        lock.unlock()
    }

    static func load(_ identifier: String) -> MppInitializeOemTokenizationResponseData? {
        lock.lock()
        defer { lock.unlock() }
        return values[identifier]
    }

    static func remove(_ identifier: String) {
        lock.lock()
        values.removeValue(forKey: identifier)
        lock.unlock()
    }
}
#endif
