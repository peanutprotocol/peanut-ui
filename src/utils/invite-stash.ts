import { EInviteType } from '@/services/services.types'

/**
 * Invite hand-off between surfaces: a payment/claim/invite page, a deep link,
 * a deferred link or the setup invite step stashes the code before the
 * visitor registers, and registration (useZeroDev) consumes it.
 *
 * One localStorage record with an explicit expiry — NOT a cookie. The stash
 * used to be a session cookie, and iOS WKWebView (capacitor:// origin) loses
 * session cookies: every iOS invite, from links and from the typed inviter
 * step alike, was gone before registration read it, so /invites/accept was
 * never called (Oct 2026, zero automatic iOS referrals since launch).
 * localStorage behaves the same on web, Android and iOS.
 *
 * The code and its type are ONE value on ONE lifecycle (Chip review round 1):
 * every write goes through stashInvite, every clear through clearInvite, and
 * the failed-accept retry extension through extendInviteForRetry — a code
 * written without its type would let a stale type from an earlier flow
 * misclassify the invite on /invites/accept. Writers that only know a bare
 * code (deep links, deferred links, ?code= at /setup) stash DIRECT.
 *
 * Nothing else may read or write this storage — `invite-stash-ownership.test.ts`
 * enforces it, so a second copy can never drift from this lifecycle again.
 */

export const INVITE_STASH_STORAGE_KEY = 'peanut:invite-stash'

/**
 * Long enough for install → first launch → signup, including app restarts;
 * short enough that a stale invite does not open /setup on the signup form
 * (past Landing's Log In) for days — the PR #2346 regression class.
 */
export const INVITE_STASH_TTL_MS = 24 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

interface InviteStash {
    code: string
    type: EInviteType
    /** The first account that attempted acceptance, or '' before any did. */
    userId: string
    /** Epoch ms after which the stash is treated as absent. */
    expiresAt: number
}

function isInviteType(value: unknown): value is EInviteType {
    return Object.values(EInviteType).includes(value as EInviteType)
}

function readStash(): InviteStash | null {
    let raw: string | null
    try {
        raw = localStorage.getItem(INVITE_STASH_STORAGE_KEY)
    } catch {
        return null
    }
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as Partial<InviteStash>
        if (typeof parsed.code !== 'string' || !parsed.code || typeof parsed.expiresAt !== 'number') {
            writeStash(null)
            return null
        }
        if (parsed.expiresAt <= Date.now()) {
            writeStash(null)
            return null
        }
        return {
            code: parsed.code,
            type: isInviteType(parsed.type) ? parsed.type : EInviteType.DIRECT,
            userId: typeof parsed.userId === 'string' ? parsed.userId : '',
            expiresAt: parsed.expiresAt,
        }
    } catch {
        writeStash(null)
        return null
    }
}

function writeStash(stash: InviteStash | null): void {
    try {
        if (stash) localStorage.setItem(INVITE_STASH_STORAGE_KEY, JSON.stringify(stash))
        else localStorage.removeItem(INVITE_STASH_STORAGE_KEY)
    } catch {
        // Storage unavailable (private mode, sandboxed document): the referral
        // is lost, but signup must never fail because of it.
    }
}

export function stashInvite(code: string, type: EInviteType): void {
    if (!code) {
        clearInvite()
        return
    }
    // A newly opened invite is not owned by an earlier authenticated retry.
    writeStash({ code, type, userId: '', expiresAt: Date.now() + INVITE_STASH_TTL_MS })
}

export function readInviteCode(): string {
    return readStash()?.code ?? ''
}

export function readInviteType(): EInviteType {
    return readStash()?.type ?? EInviteType.DIRECT
}

export function readInviteUserId(): string {
    return readStash()?.userId ?? ''
}

/** Bind a pre-auth invite to the first account that attempts acceptance. */
export function bindInviteToUser(userId: string): boolean {
    const normalizedUserId = userId.trim()
    if (!normalizedUserId) return false
    const stash = readStash()
    if (!stash) return false
    if (stash.userId && stash.userId !== normalizedUserId) return false
    if (!stash.userId) writeStash({ ...stash, userId: normalizedUserId })
    return true
}

function isOwnedInvite(stash: InviteStash | null, inviteCode: string, userId: string): stash is InviteStash {
    return !!stash && stash.code === inviteCode && stash.userId === userId
}

/**
 * A failed /invites/accept keeps the invite for a later retry — code, type
 * and owner together, on one extended lifetime (Chip review round 1: the old
 * path extended the code alone).
 */
export function extendInviteForRetry(days: number = 30, expected?: { inviteCode: string; userId: string }): void {
    const stash = readStash()
    if (!stash) return
    if (expected && !isOwnedInvite(stash, expected.inviteCode, expected.userId)) return
    writeStash({ ...stash, expiresAt: Date.now() + days * DAY_MS })
}

export function clearInvite(): void {
    writeStash(null)
}

/** Do not let an older in-flight request clear a newer account/code hand-off. */
export function clearInviteIfOwnedBy(inviteCode: string, userId: string): boolean {
    if (!isOwnedInvite(readStash(), inviteCode, userId)) return false
    clearInvite()
    return true
}
