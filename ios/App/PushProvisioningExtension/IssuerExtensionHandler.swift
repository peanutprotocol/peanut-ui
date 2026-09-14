import PassKit
import UIKit
#if canImport(MeaPushProvisioning)
import MeaPushProvisioning
#endif

/*
 * Non-UI issuer-provisioning extension (NSExtensionPointIdentifier
 * com.apple.PassKit.issuer-provisioning): lets Apple Wallet itself offer
 * "add your Peanut card" and drive the provisioning flow without opening the
 * app. Required by Rain/Apple for push-provisioning go-live.
 *
 * Same dark-ship rules as PushProvisioningPlugin.swift: the MeaWallet SDK is
 * credential-gated, so all SDK calls are canImport-fenced; without the SDK the
 * extension reports "no passes available" and Wallet simply doesn't list us.
 * Constraints from Apple: status() must answer within 100ms (hence the
 * app-group mirror in WalletExtensionCardStore — no network), passEntries and
 * the request generation within 20s, and the whole extension within 55MB.
 *
 * TODO(go-live): passEntries needs provisioning credentials (processor cardId
 * + time-based secret) from our backend. That requires an extension-usable
 * auth path — the main app's session token shared via app-group keychain, and
 * a backend decision on step-up for the extension context. Until that lands,
 * entries stay empty and Wallet falls back to sending users into the app.
 */
@available(iOS 14.0, *)
class IssuerExtensionHandler: PKIssuerProvisioningExtensionHandler {

    override func status(completion: @escaping (PKIssuerProvisioningExtensionStatus) -> Void) {
        let status = PKIssuerProvisioningExtensionStatus()
#if canImport(MeaPushProvisioning)
        let card = WalletExtensionCardStore.load()
        let hasConfig = Bundle.main.url(forResource: "mea_config", withExtension: nil) != nil
        let available = card != nil && hasConfig
        status.passEntriesAvailable = available
        status.remotePassEntriesAvailable = available
        status.requiresAuthentication = true
#else
        status.passEntriesAvailable = false
        status.remotePassEntriesAvailable = false
#endif
        completion(status)
    }

    override func passEntries(completion: @escaping ([PKIssuerProvisioningExtensionPassEntry]) -> Void) {
        // TODO(go-live): fetch processor details via the shared session, run
        // MeaPushProvisioning.initializeOemTokenization, and build a
        // PKIssuerProvisioningExtensionPaymentPassEntry per addable card
        // (identifier = our card id, art = square-cornered card art without PII).
        completion([])
    }

    override func remotePassEntries(completion: @escaping ([PKIssuerProvisioningExtensionPassEntry]) -> Void) {
        completion([])
    }

    override func generateAddPaymentPassRequestForPassEntryWithIdentifier(
        _ identifier: String,
        configuration: PKAddPaymentPassRequestConfiguration,
        certificateChain certificates: [Data],
        nonce: Data,
        nonceSignature: Data,
        completionHandler completion: @escaping (PKAddPaymentPassRequest?) -> Void
    ) {
#if canImport(MeaPushProvisioning)
        // TODO(go-live): complete via MeaPushProvisioning.completeOemTokenization
        // with the tokenization receipt obtained in passEntries.
        completion(nil)
#else
        completion(nil)
#endif
    }
}
