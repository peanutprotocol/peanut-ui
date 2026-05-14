/**
 * "Given recipient data, produce a display name + URL slug" — replaces the
 * ad-hoc `account.user?.username ?? printableAddress(addr)` shapes scattered
 * across the codebase. Preference order:
 *
 *   1. Peanut username (when a user is linked to the recipient account)
 *   2. ENS name (when one is known — provided by the caller, not resolved here)
 *   3. Shortened 0x address
 *
 * Pure / synchronous. ENS lookup is async and lives in `useRecipientDisplay`.
 */
import { printableAddress } from './general.utils'

export type RecipientKind = 'username' | 'ens' | 'address'

export type RecipientDisplay = {
    displayName: string
    kind: RecipientKind
}

export type ResolveRecipientInput = {
    user?: { username?: string | null } | null
    address: string
    ensName?: string | null
}

export function resolveRecipientDisplay(input: ResolveRecipientInput): RecipientDisplay {
    if (input.user?.username) {
        return { displayName: input.user.username, kind: 'username' }
    }
    if (input.ensName) {
        return { displayName: input.ensName, kind: 'ens' }
    }
    return { displayName: printableAddress(input.address), kind: 'address' }
}
