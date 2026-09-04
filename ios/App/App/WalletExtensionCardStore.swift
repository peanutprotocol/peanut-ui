import Foundation

/*
 * Shared card metadata for the Wallet issuer-provisioning extensions.
 *
 * The non-UI extension (PushProvisioningExtension) runs without the main app
 * and must answer Apple Wallet's status() within 100ms, so the card facts it
 * needs (is there a provisionable card, its display title, last4) are mirrored
 * into the shared app-group container by the main app. The PushProvisioning
 * plugin writes this on every successful isAvailable()/addCard() so the
 * mirror tracks card state without any extra plumbing.
 *
 * This file is compiled into BOTH the app target and PushProvisioningExtension.
 * Only non-sensitive display metadata belongs here — never card secrets: the
 * extension fetches provisioning credentials on demand (see the TODO in
 * IssuerExtensionHandler).
 */
enum WalletExtensionCardStore {
    // Dedicated group (not the OneSignal one) — registered in the Apple
    // Developer portal alongside the extension App IDs.
    static let appGroupId = "group.me.peanut.wallet"
    private static let cardKey = "walletExtensionCard"

    struct Card: Codable {
        let cardId: String
        let last4: String
        let title: String
    }

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    static func save(_ card: Card) {
        guard let data = try? JSONEncoder().encode(card) else { return }
        defaults?.set(data, forKey: cardKey)
    }

    static func load() -> Card? {
        guard let data = defaults?.data(forKey: cardKey) else { return nil }
        return try? JSONDecoder().decode(Card.self, from: data)
    }

    static func clear() {
        defaults?.removeObject(forKey: cardKey)
    }
}
