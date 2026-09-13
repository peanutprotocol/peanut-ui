import Foundation
import Security

/**
 * Credentials shared by the app and the Wallet issuer extensions.
 *
 * The item is kept in the dedicated Wallet keychain access group. The issuer
 * extension only reads it after Apple's authorization extension has completed
 * device-owner authentication; it is never copied to the app group defaults.
 */
enum WalletExtensionAuth {
    private static let accessGroupInfoKey = "PeanutWalletKeychainAccessGroup"
    private static let service = "me.peanut.wallet.wallet-extension"
    private static let sessionAccount = "session"
    private static let stepUpAccount = "step-up"

    private static var accessGroup: String? {
        Bundle.main.object(forInfoDictionaryKey: accessGroupInfoKey) as? String
    }

    static func saveSessionToken(_ token: String) {
        save(token, account: sessionAccount)
    }

    static func saveStepUpToken(_ token: String, expiresIn: Int) {
        let payload = StepUpPayload(token: token, expiresAt: Date().timeIntervalSince1970 + Double(expiresIn))
        guard let data = try? JSONEncoder().encode(payload),
              let encoded = String(data: data, encoding: .utf8) else { return }
        save(encoded, account: stepUpAccount)
    }

    private static func save(_ value: String, account: String) {
        guard let data = value.data(using: .utf8), let accessGroup else { return }
        delete(account: account)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        _ = SecItemAdd(query as CFDictionary, nil)
    }

    static func sessionToken() -> String? {
        read(account: sessionAccount)
    }

    static func stepUpToken() -> String? {
        guard let encoded = read(account: stepUpAccount),
              let data = encoded.data(using: .utf8),
              let payload = try? JSONDecoder().decode(StepUpPayload.self, from: data),
              payload.expiresAt - 30 > Date().timeIntervalSince1970 else {
            deleteStepUpToken()
            return nil
        }
        return payload.token
    }

    private static func read(account: String) -> String? {
        guard let accessGroup else { return nil }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func deleteSessionToken() {
        delete(account: sessionAccount)
    }

    static func deleteStepUpToken() {
        delete(account: stepUpAccount)
    }

    private static func delete(account: String) {
        guard let accessGroup else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
        _ = SecItemDelete(query as CFDictionary)
    }

    private struct StepUpPayload: Codable {
        let token: String
        let expiresAt: TimeInterval
    }
}
