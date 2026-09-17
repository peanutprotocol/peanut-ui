import { validateInviteCode } from '@/app/actions/invites'
import { serverFetch } from '@/utils/api-fetch'
import { toInviteCode } from '@/utils/general.utils'
import { isCapacitor } from '@/utils/capacitor'
import { enableDemoMode, isDemoInviteCode } from '@/utils/demo'
import { EInviteType, type PointsInvitesResponse } from './services.types'
import { badgeCampaignClaimsFromPayload, type BadgeCampaignClaim } from './badge-campaigns'
import { parseLegacyInviteAcquisition, type LegacyInviteAcquisition } from './invite-acquisition'
import { isTypedCampaignOnlyInviteResponse, resolveInviteResolutionFlags } from './invite-response'

type AcceptInviteResolution = {
    attributionResolved: boolean
    onboardingResolved: boolean
    claims: BadgeCampaignClaim[]
    legacyAcquisition?: LegacyInviteAcquisition
}

export type AcceptInviteResult =
    | ({ success: true } & AcceptInviteResolution)
    | ({ success: false; retryable: boolean; status?: number } & AcceptInviteResolution)

function failedAcceptInvite(retryable: boolean, status?: number): AcceptInviteResult {
    return {
        success: false,
        retryable,
        ...(status === undefined ? {} : { status }),
        attributionResolved: false,
        onboardingResolved: false,
        claims: [],
    }
}

export type ValidateInviteResult = {
    success: boolean
    attributionResolved: boolean
    onboardingResolved: boolean
    username: string
    legacyAcquisition?: LegacyInviteAcquisition
}

export const invitesApi = {
    acceptInvite: async (inviteCode: string, type: EInviteType, campaignTag?: string): Promise<AcceptInviteResult> => {
        let response: Response
        try {
            response = await serverFetch('/invites/accept', {
                method: 'POST',
                // Normalize here so hand-typed input (`@alice `, ` Alice`) works no
                // matter which screen collected it. Legacy ALICEINVITESYOU610 codes
                // pass through unchanged in meaning — the BE uppercases before parsing.
                // Inviter attribution and campaign acquisition remain separate
                // fields. Published send links still carry one opaque campaign
                // tag through this compatibility call.
                body: JSON.stringify({ inviteCode: toInviteCode(inviteCode), type, campaignTag }),
            })
        } catch {
            return failedAcceptInvite(true)
        }

        let body: unknown
        try {
            body = await response.json()
        } catch {
            return failedAcceptInvite(response.status >= 500, response.status)
        }
        const typedCampaignOnly =
            response.status === 409 &&
            isTypedCampaignOnlyInviteResponse(body) &&
            !!body &&
            typeof body === 'object' &&
            Array.isArray((body as { claims?: unknown }).claims)
        if (!response.ok && !typedCampaignOnly) {
            // Only transport failures and 5xx responses are safe to retain for
            // retry. Invalid/forbidden codes are terminal and must not become
            // a future referral if that username is registered later.
            return failedAcceptInvite(response.status >= 500, response.status)
        }
        const legacyAcquisition = parseLegacyInviteAcquisition(
            body && typeof body === 'object' ? (body as { legacyAcquisition?: unknown }).legacyAcquisition : undefined
        )
        const resolution = resolveInviteResolutionFlags(body, response.ok)
        return {
            success: true,
            ...resolution,
            claims: legacyAcquisition ? badgeCampaignClaimsFromPayload(body, [legacyAcquisition.campaignTag]) : [],
            ...(legacyAcquisition ? { legacyAcquisition } : {}),
        }
    },

    getInvites: async (): Promise<PointsInvitesResponse> => {
        try {
            const response = await serverFetch('/points/invites', {
                method: 'GET',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch invites')
            }
            const invitesRes: PointsInvitesResponse = await response.json()
            return invitesRes
        } catch (e) {
            console.log(e)
            throw new Error('Failed to fetch invites')
        }
    },

    validateInviteCode: async (inviteCode: string): Promise<ValidateInviteResult> => {
        try {
            const res = await validateInviteCode(toInviteCode(inviteCode))
            // demo code enables demo mode.
            if (res.data?.success && isCapacitor() && isDemoInviteCode(inviteCode)) {
                enableDemoMode()
            }
            return {
                success: res.data?.success || false,
                attributionResolved: res.data?.attributionResolved === true,
                onboardingResolved: res.data?.onboardingResolved === true,
                username: res.data?.username || '',
                legacyAcquisition: res.data?.legacyAcquisition,
            }
        } catch (e) {
            console.error('Error validating invite code:', e)
            return { success: false, attributionResolved: false, onboardingResolved: false, username: '' }
        }
    },
}
