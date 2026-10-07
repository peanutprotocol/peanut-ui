import { EInviteType } from '@/services/services.types'
// cookie-url.utils directly, NOT general.utils: useNativeAppLinks (mounted on
// every route via ClientProviders) imports this stash, and general.utils pulls
// the ~189 KB token-catalog graph the cookie-url split exists to keep out
// (Chip review round 3)
import { getFromCookie, saveToCookie } from '@/utils/cookie-url.utils'

/**
 * Invite hand-off between surfaces: a payment/claim/invite page stashes the
 * code before pushing the visitor into /setup, and registration (useZeroDev)
 * consumes it. Cookies, not app state — the hand-off must survive the
 * store hand-off and app restarts, which is why the invite code already lived
 * in a cookie alongside its old redux mirror (the mirror is gone,
 * TASK-21460/TASK-21462).
 *
 * The code and its type are ONE value on ONE lifecycle (Chip review round 1):
 * every write goes through stashInvite, every clear through clearInvite, and
 * the failed-accept retry extension through extendInviteForRetry — a code
 * written without its type would let a stale type from an earlier flow
 * misclassify the invite on /invites/accept. Writers that only know a bare
 * code (deep links, deferred links, ?code= at /setup) stash DIRECT, which is
 * what the old per-session redux default made them mean.
 */

const INVITE_CODE_COOKIE = 'inviteCode'
const INVITE_TYPE_COOKIE = 'inviteType'
const INVITE_USER_COOKIE = 'inviteAttributionUserId'

/** Session scope (no expiry): attribution self-heals on app restart. */
export function stashInvite(code: string, type: EInviteType): void {
    saveToCookie(INVITE_CODE_COOKIE, code)
    saveToCookie(INVITE_TYPE_COOKIE, type)
    // A newly opened invite is not owned by an earlier authenticated retry.
    saveToCookie(INVITE_USER_COOKIE, '')
}

export function readInviteCode(): string {
    return getFromCookie(INVITE_CODE_COOKIE) ?? ''
}

export function readInviteType(): EInviteType {
    const raw = getFromCookie(INVITE_TYPE_COOKIE)
    return Object.values(EInviteType).includes(raw as EInviteType) ? (raw as EInviteType) : EInviteType.DIRECT
}

export function readInviteUserId(): string {
    const raw = getFromCookie(INVITE_USER_COOKIE)
    return typeof raw === 'string' ? raw : ''
}

/** Bind a pre-auth invite to the first account that attempts acceptance. */
export function bindInviteToUser(userId: string): boolean {
    const normalizedUserId = userId.trim()
    if (!normalizedUserId) return false
    const boundUserId = readInviteUserId()
    if (boundUserId && boundUserId !== normalizedUserId) return false
    if (!boundUserId) saveToCookie(INVITE_USER_COOKIE, normalizedUserId)
    return true
}

function isOwnedInvite(inviteCode: string, userId: string): boolean {
    return readInviteCode() === inviteCode && readInviteUserId() === userId
}

/**
 * A failed /invites/accept keeps the invite for a later retry — both fields,
 * same extended lifetime, or the retry would re-send the code with a decayed
 * type (Chip review round 1: the old path extended the code alone).
 */
export function extendInviteForRetry(days: number = 30, expected?: { inviteCode: string; userId: string }): void {
    if (expected && !isOwnedInvite(expected.inviteCode, expected.userId)) return
    const code = readInviteCode()
    if (!code) return
    saveToCookie(INVITE_CODE_COOKIE, code, days)
    saveToCookie(INVITE_TYPE_COOKIE, readInviteType(), days)
    const userId = readInviteUserId()
    if (userId) saveToCookie(INVITE_USER_COOKIE, userId, days)
}

export function clearInvite(): void {
    saveToCookie(INVITE_CODE_COOKIE, '')
    saveToCookie(INVITE_TYPE_COOKIE, '')
    saveToCookie(INVITE_USER_COOKIE, '')
}

/** Do not let an older in-flight request clear a newer account/code hand-off. */
export function clearInviteIfOwnedBy(inviteCode: string, userId: string): boolean {
    if (!isOwnedInvite(inviteCode, userId)) return false
    clearInvite()
    return true
}
