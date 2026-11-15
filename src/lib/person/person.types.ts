declare const personBrand: unique symbol

/**
 * A Peanut user as a surface shows them. Built only by `personFrom`, so a
 * loose `{ username, avatarKey }` bag cannot pose as one: a surface that
 * never resolved the person cannot render their avatar (TASK-23756).
 */
export interface Person {
    readonly [personBrand]: true
    userId: string | null
    username: string
    /** fullName when the user shows it, else the handle. */
    displayName: string
    /** The pick the API resolved, or null = never picked (the handle's letter). Never undefined. */
    avatarKey: string | null
}

/** Every identity block the API sends fits this: ApiUser, Contact, User, HistoryEntry accounts, charge payerAccount.user, requestLink.recipientAccount.user, send-link sender, invitees. */
export interface WirePerson {
    userId?: string | null
    username?: string | null
    fullName?: string | null
    showFullName?: boolean | null
    avatarKey?: string | null
}
