import Capacitor
import PassKit
import UIKit
#if canImport(MeaPushProvisioning)
import MeaPushProvisioning
#endif

/*
 * Apple Pay in-app provisioning via the MeaWallet MPP SDK.
 *
 * The SDK xcframework is vendored by scripts/native-ios-postsync.js only when
 * Nexus credentials are present (it is proprietary and never committed), so
 * everything SDK-touching is fenced behind canImport — without the framework
 * this compiles to a stub whose isAvailable() is false and the web layer keeps
 * the manual add-to-wallet carousel. canAddPaymentPass() is also false until
 * Apple grants the payment-pass-provisioning entitlement, which keeps the
 * feature dormant on shipped binaries even once the SDK is bundled.
 */
@objc(PushProvisioningPlugin)
public class PushProvisioningPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PushProvisioningPlugin"
    public let jsName = "PushProvisioning"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addCard", returnType: CAPPluginReturnPromise)
    ]

    private static func hasMeaConfig() -> Bool {
        Bundle.main.url(forResource: "mea_config", withExtension: nil) != nil
    }

#if canImport(MeaPushProvisioning)
    private var currentCall: CAPPluginCall?
    private var tokenizationResponseData: MppInitializeOemTokenizationResponseData?
    private var pendingCard: WalletExtensionCardStore.Card?

    @objc func isAvailable(_ call: CAPPluginCall) {
        let passKitReady = PKPassLibrary.isPassLibraryAvailable() && PKAddPaymentPassViewController.canAddPaymentPass()
        guard passKitReady && Self.hasMeaConfig() else {
            call.resolve(["available": false, "alreadyInWallet": false])
            return
        }
        // Suffix check covers iPhone + paired Watch; the card is "already in
        // wallet" only when NEITHER device can take it.
        var alreadyInWallet = false
        if let last4 = call.getString("last4"), !last4.isEmpty {
            let canAddLocal = MeaPushProvisioning.canAddSecureElementPass(withPrimaryAccountNumberSuffix: last4)
            let canAddRemote = MeaPushProvisioning.canAddRemoteSecureElementPass(withPrimaryAccountNumberSuffix: last4)
            alreadyInWallet = !canAddLocal && !canAddRemote
        }
        call.resolve(["available": !alreadyInWallet, "alreadyInWallet": alreadyInWallet])
    }

    @objc func addCard(_ call: CAPPluginCall) {
        guard let cardId = call.getString("cardId"), let cardSecret = call.getString("cardSecret") else {
            call.reject("cardId and cardSecret are required", "BAD_PARAMS")
            return
        }
        guard Self.hasMeaConfig() else {
            call.reject("MeaWallet config missing from bundle", "UNAVAILABLE")
            return
        }
        guard currentCall == nil else {
            call.reject("A provisioning flow is already in progress", "IN_PROGRESS")
            return
        }

        let cardParams = MppCardDataParameters(cardId: cardId, cardSecret: cardSecret)
        MeaPushProvisioning.initializeOemTokenization(cardParams) { [weak self] responseData, error in
            guard let self = self else { return }
            guard let data = responseData, data.isValid() else {
                call.reject(error?.localizedDescription ?? "Tokenization initialization failed", "INIT_FAILED")
                return
            }
            // Non-empty primaryAccountIdentifier + no addable device = the pass
            // already exists everywhere it can.
            if let pai = data.primaryAccountIdentifier, !pai.isEmpty,
               !MeaPushProvisioning.canAddSecureElementPass(withPrimaryAccountIdentifier: pai) {
                call.resolve(["added": false, "alreadyInWallet": true])
                return
            }
            guard let config = data.addPaymentPassRequestConfiguration else {
                call.reject("No pass request configuration", "INIT_FAILED")
                return
            }
            if let name = call.getString("cardholderName"), !name.isEmpty {
                config.cardholderName = name
            }
            guard let controller = PKAddPaymentPassViewController(requestConfiguration: config, delegate: self) else {
                call.reject("Cannot present Apple Wallet sheet (entitlement missing?)", "UNAVAILABLE")
                return
            }
            self.tokenizationResponseData = data
            self.currentCall = call
            self.pendingCard = WalletExtensionCardStore.Card(
                cardId: cardId,
                last4: call.getString("last4") ?? "",
                title: call.getString("displayName") ?? "Peanut Card"
            )
            DispatchQueue.main.async {
                self.bridge?.viewController?.present(controller, animated: true)
            }
        }
    }
#else
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": false, "alreadyInWallet": false])
    }

    @objc func addCard(_ call: CAPPluginCall) {
        call.reject("MeaWallet SDK not bundled in this binary", "UNAVAILABLE")
    }
#endif
}

#if canImport(MeaPushProvisioning)
extension PushProvisioningPlugin: PKAddPaymentPassViewControllerDelegate {
    public func addPaymentPassViewController(
        _ controller: PKAddPaymentPassViewController,
        generateRequestWithCertificateChain certificates: [Data],
        nonce: Data,
        nonceSignature: Data,
        completionHandler handler: @escaping (PKAddPaymentPassRequest) -> Void
    ) {
        guard let receipt = tokenizationResponseData?.tokenizationReceipt else {
            // PassKit requires the handler to be called; an empty request makes
            // the sheet fail and reach didFinishAdding with an error.
            handler(PKAddPaymentPassRequest())
            return
        }
        let tokenizationData = MppCompleteOemTokenizationData(
            tokenizationReceipt: receipt,
            certificates: certificates,
            nonce: nonce,
            nonceSignature: nonceSignature
        )
        MeaPushProvisioning.completeOemTokenization(tokenizationData) { responseData, _ in
            if let data = responseData, data.isValid(), let request = data.addPaymentPassRequest {
                handler(request)
            } else {
                handler(PKAddPaymentPassRequest())
            }
        }
    }

    public func addPaymentPassViewController(
        _ controller: PKAddPaymentPassViewController,
        didFinishAdding pass: PKPaymentPass?,
        error: Error?
    ) {
        DispatchQueue.main.async {
            self.bridge?.viewController?.presentedViewController?.dismiss(animated: true)
        }
        let call = currentCall
        let card = pendingCard
        currentCall = nil
        tokenizationResponseData = nil
        pendingCard = nil
        if let pass = pass, error == nil {
            // Mirror the card into the shared app-group store so the Wallet
            // issuer-provisioning extension can answer status() without the app.
            if let card = card { WalletExtensionCardStore.save(card) }
            call?.resolve(["added": true, "last4": pass.primaryAccountNumberSuffix])
        } else if let error = error {
            call?.resolve(["added": false, "error": error.localizedDescription])
        } else {
            // Nil pass + nil error = the user closed the sheet.
            call?.resolve(["added": false, "canceled": true])
        }
    }
}
#endif
