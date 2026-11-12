import { BASE_URL } from '@/constants/general.consts'
import { KEEP_WEB_COOKIE, KEEP_WEB_TOKEN } from '@/constants/migration.consts'
import { BADGE_CAMPAIGN_QUERY_PARAM, getPendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'
import { EInviteType } from '@/services/services.types'
import { INVITE_TYPE_PARAM, readInviteCode, readInviteIntent, readInviteType } from '@/utils/invite-stash'
import { getStoredRedirect, getValidRedirectUrl } from '@/utils/general.utils'

/**
 * Web signup with the keep-web hatch open, for a phone whose passkey provider
 * the app cannot use (TASK-24498). In a browser the browser writes the signed
 * note, so the passkey signs in the layout the wallet validator reads.
 *
 * The browser does not share the app's storage, so the signup context travels
 * in the params /setup restores: the invite (`code`, so the inviter gets the
 * credit, and `invite_type` when it is a PAYMENT_LINK invite, which the
 * referral edge and `invite_acceptance` record; a passive tracked-link inviter
 * travels as `acq_invite`, so the browser does not treat it as a chosen invite),
 * the queued badge campaigns
 * (`badge_campaign`) and the return path (`redirect_uri`).
 */
export function keepWebSignupUrl(): string {
    const params = new URLSearchParams({ [KEEP_WEB_COOKIE]: KEEP_WEB_TOKEN })
    const inviteCode = readInviteCode()
    if (inviteCode && readInviteIntent() === 'acquisition') {
        params.set('acq_invite', inviteCode)
    } else if (inviteCode) {
        params.set('code', inviteCode)
        if (readInviteType() === EInviteType.PAYMENT_LINK) params.set(INVITE_TYPE_PARAM, EInviteType.PAYMENT_LINK)
    }
    for (const badgeCampaign of getPendingBadgeCampaigns()) params.append(BADGE_CAMPAIGN_QUERY_PARAM, badgeCampaign)
    const redirect = signupReturnPath()
    if (redirect) params.set('redirect_uri', redirect)
    return `${BASE_URL}/setup?${params}`
}

/**
 * The page signup returns to, by the rules a new account follows here: the
 * explicit `redirect_uri` first, then a stored one, never the page where an
 * earlier session ended. Only a safe same-origin path goes, and never /setup.
 */
function signupReturnPath(): string | null {
    const explicit = new URLSearchParams(window.location.search).get('redirect_uri')
    const stored = explicit === null ? getStoredRedirect() : null
    const candidate = explicit ?? (stored && stored.origin !== 'session-end' ? stored.destination : null)
    if (!candidate) return null
    const path = getValidRedirectUrl(candidate, '')
    return path && !path.startsWith('/setup') ? path : null
}
