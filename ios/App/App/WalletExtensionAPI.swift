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
 * authenticated provisioning endpoint directly. The JWT comes from the
 * app/extension keychain access group; no PAN or provisioning secret is cached
 * on disk. Apple invokes this after the authorization extension has run.
 */
enum WalletExtensionAPI {
    private static let endpoint = URL(string: "https://api.peanut.me")!
    private static let timeout: TimeInterval = 9

    static func fetchProvisioningData(
        cardId: String,
        sessionToken: String,
        stepUpToken: String?,
        completion: @escaping (WalletExtensionProvisioningData?) -> Void
    ) {
        let url = endpoint.appendingPathComponent("rain/cards/\(cardId)/provisioning-data")
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        if let stepUpToken, !stepUpToken.isEmpty {
            request.setValue(stepUpToken, forHTTPHeaderField: "x-step-up-token")
        }
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
