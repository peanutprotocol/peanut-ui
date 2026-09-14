import LocalAuthentication
import PassKit
import UIKit

/*
 * Authorization UI extension (NSExtensionPointIdentifier
 * com.apple.PassKit.issuer-provisioning.authorization): Apple Wallet presents
 * this when the non-UI extension reports requiresAuthentication. It runs in
 * its own process with a 60MB limit and must NOT redirect to the app — it
 * authenticates in place. Device-owner authentication (biometics/passcode)
 * matches the app's own gating for card material.
 */
@available(iOS 14.0, *)
class IssuerAuthorizationExtensionHandler: UIViewController, PKIssuerProvisioningExtensionAuthorizationProviding {
    var completionHandler: ((PKIssuerProvisioningExtensionAuthorizationResult) -> Void)?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        authenticateUser()
    }

    private func authenticateUser() {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            completionHandler?(.canceled)
            return
        }
        context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: NSLocalizedString("Confirm it's you to add your card to Apple Pay", comment: "")
        ) { [weak self] success, _ in
            DispatchQueue.main.async {
                self?.completionHandler?(success ? .authorized : .canceled)
            }
        }
    }
}
