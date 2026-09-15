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
 */
@available(iOS 14.0, *)
class IssuerExtensionHandler: PKIssuerProvisioningExtensionHandler {

    override func status(completion: @escaping (PKIssuerProvisioningExtensionStatus) -> Void) {
        let status = PKIssuerProvisioningExtensionStatus()
#if canImport(MeaPushProvisioning)
        let card = WalletExtensionCardStore.load()
        let hasConfig = Bundle.main.url(forResource: "mea_config", withExtension: nil) != nil
        let available = card != nil && hasConfig && WalletExtensionAuth.authorizationToken() != nil
        status.passEntriesAvailable = available
        status.remotePassEntriesAvailable = available
        status.requiresAuthentication = true
#else
        status.passEntriesAvailable = false
        status.remotePassEntriesAvailable = false
        status.requiresAuthentication = false
#endif
        completion(status)
    }

    override func passEntries(completion: @escaping ([PKIssuerProvisioningExtensionPassEntry]) -> Void) {
        loadEntry(remote: false, completion: completion)
    }

    override func remotePassEntries(completion: @escaping ([PKIssuerProvisioningExtensionPassEntry]) -> Void) {
        loadEntry(remote: true, completion: completion)
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
        guard let initialized = WalletProvisioningSession.load(identifier),
              let receipt = initialized.tokenizationReceipt else {
            completion(nil)
            return
        }
        let tokenizationData = MppCompleteOemTokenizationData(
            tokenizationReceipt: receipt,
            certificates: certificates,
            nonce: nonce,
            nonceSignature: nonceSignature
        )
        MeaPushProvisioning.completeOemTokenization(tokenizationData) { responseData, _ in
            guard let responseData,
                  responseData.isValid() else {
                WalletProvisioningSession.remove(identifier)
                completion(nil)
                return
            }
            completion(responseData.addPaymentPassRequest)
            WalletProvisioningSession.remove(identifier)
        }
#else
        completion(nil)
#endif
    }

#if canImport(MeaPushProvisioning)
    private func loadEntry(
        remote: Bool,
        completion: @escaping ([PKIssuerProvisioningExtensionPassEntry]) -> Void
    ) {
        guard let card = WalletExtensionCardStore.load(),
              let token = WalletExtensionAuth.authorizationToken(),
              Bundle.main.url(forResource: "mea_config", withExtension: nil) != nil else {
            completion([])
            return
        }

        WalletExtensionAPI.fetchProvisioningData(
            cardId: card.cardId,
            authorizationToken: token
        ) { provisioningData in
            guard let provisioningData else {
                completion([])
                return
            }
            if let replacement = provisioningData.walletAuthorizationToken,
               let expiresIn = provisioningData.walletAuthorizationExpiresIn,
               expiresIn > 0 {
                WalletExtensionAuth.saveAuthorizationToken(replacement, expiresIn: expiresIn)
            }
            let cardParams = MppCardDataParameters(
                cardId: provisioningData.cardId,
                cardSecret: provisioningData.cardSecret
            )
            MeaPushProvisioning.initializeOemTokenization(cardParams) { responseData, _ in
                guard let responseData,
                      responseData.isValid(),
                      let configuration = responseData.addPaymentPassRequestConfiguration else {
                    completion([])
                    return
                }

                if let identifier = responseData.primaryAccountIdentifier, !identifier.isEmpty {
                    let canAdd = remote
                        ? MeaPushProvisioning.canAddRemoteSecureElementPass(withPrimaryAccountIdentifier: identifier)
                        : MeaPushProvisioning.canAddSecureElementPass(withPrimaryAccountIdentifier: identifier)
                    guard canAdd else {
                        completion([])
                        return
                    }
                }

                if let name = provisioningData.cardholderName, !name.isEmpty {
                    configuration.cardholderName = name
                }
                WalletProvisioningSession.store(responseData, for: card.cardId)
                guard let art = WalletCardArtwork.image.cgImage,
                      let entry = PKIssuerProvisioningExtensionPaymentPassEntry(
                          identifier: card.cardId,
                          title: card.title,
                          art: art,
                          addRequestConfiguration: configuration
                      ) else {
                    WalletProvisioningSession.remove(card.cardId)
                    completion([])
                    return
                }
                completion([entry])
            }
        }
    }
#else
    private func loadEntry(
        remote: Bool,
        completion: @escaping ([PKIssuerProvisioningExtensionPassEntry]) -> Void
    ) {
        completion([])
    }
#endif
}
