import { EInviteType } from '@/services/services.types'
import { getFromCookie, saveToCookie } from '@/utils/general.utils'

/**
 * Invite hand-off between surfaces: a payment/claim/invite page stashes the
 * code before pushing the visitor into /setup, and registration (useZeroDev)
 * consumes it. Cookies, not app state — the hand-off must survive the
 * PWA-install hop and app restarts, which is why the invite code already
 * lived in a cookie alongside its old redux mirror (the mirror is gone,
 * TASK-21460/TASK-21462).
 */

const INVITE_CODE_COOKIE = 'inviteCode'
const INVITE_TYPE_COOKIE = 'inviteType'

export function stashInvite(code: string, type: EInviteType): void {
    saveToCookie(INVITE_CODE_COOKIE, code)
    saveToCookie(INVITE_TYPE_COOKIE, type)
}

export function readInviteCode(): string {
    return getFromCookie(INVITE_CODE_COOKIE) ?? ''
}

export function readInviteType(): EInviteType {
    const raw = getFromCookie(INVITE_TYPE_COOKIE)
    return Object.values(EInviteType).includes(raw as EInviteType) ? (raw as EInviteType) : EInviteType.DIRECT
}

export function clearInvite(): void {
    saveToCookie(INVITE_CODE_COOKIE, '')
    saveToCookie(INVITE_TYPE_COOKIE, '')
}
