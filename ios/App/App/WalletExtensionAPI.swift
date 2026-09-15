import Foundation

/** The deliberately small response shape the Wallet extension needs. */
struct WalletExtensionProvisioningData: Decodable {
    let cardId: String
    let cardSecret: String
    let last4: String
    let network: String
    let cardholderName: String?
}

/**
 * Native-only client for the issuer extension.
 *
 * Wallet cannot execute the Capacitor web layer, so it calls the same
 * provisioning service directly. The app stores a short-lived, card-scoped
 * authorization credential in the extension keychain; no session JWT, PAN, or
 * provisioning secret is needed in the extension process.
 */
enum WalletExtensionAPI {
    private static let endpoint = URL(string: "https://api.peanut.me")!
    private static let timeout: TimeInterval = 9

    static func fetchProvisioningData(
        cardId: String,
        authorizationToken: String,
        completion: @escaping (WalletExtensionProvisioningData?) -> Void
    ) {
        let url = endpoint.appendingPathComponent("rain/cards/\(cardId)/provisioning-data/wallet")
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(authorizationToken, forHTTPHeaderField: "x-wallet-provisioning-token")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["wallet": "apple"])

        URLSession(configuration: .ephemeral).dataTask(with: request) { data, response, _ in
            guard let data,
                  let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode) else {
                completion(nil)
                return
            }
            completion(try? JSONDecoder().decode(WalletExtensionProvisioningData.self, from: data))
        }.resume()
    }
}
