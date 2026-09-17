import posthog from 'posthog-js'
import { captureException } from '@/utils/sentry-lazy'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { clearInvite, extendInviteForRetry, readInviteCode, readInviteType } from '@/utils/invite-stash'
import { settleAcceptedInviteAcquisition } from './invite-acquisition'
import { invitesApi, type AcceptInviteResult } from './invites'
import type { EInviteType } from './services.types'

export type PendingInviteAttributionOutcome = {
    status: 'none' | 'attributed' | 'campaign_only' | 'retryable'
    inviteCode?: string
    inviteType?: EInviteType
    result?: AcceptInviteResult
    pendingCampaigns?: string[]
}

let inFlight: Promise<PendingInviteAttributionOutcome> | null = null

/**
 * Records a stashed inviter after authentication. The invite cookie is only
 * cleared after the API confirms either the immutable referral edge or a
 * terminal legacy campaign-only hand-off. Failures remain durable for the
 * next authenticated app start and never block open signup.
 */
export function settlePendingInviteAttribution(): Promise<PendingInviteAttributionOutcome> {
    if (inFlight) return inFlight

    const attempt = settlePendingInviteAttributionOnce().catch((error): PendingInviteAttributionOutcome => {
        // Cookie/storage reads are expected to be safe, but attribution is
        // never allowed to turn a completed registration into a failed one.
        captureException(error, { tags: { error_type: 'invite_attribution_recovery_failed' } })
        return { status: 'retryable' }
    })
    const trackedAttempt = attempt.finally(() => {
        inFlight = null
    })
    inFlight = trackedAttempt
    return trackedAttempt
}

async function settlePendingInviteAttributionOnce(): Promise<PendingInviteAttributionOutcome> {
    const inviteCode = readInviteCode().trim()
    if (!inviteCode) return { status: 'none' }

    const inviteType = readInviteType()
    try {
        const result = await invitesApi.acceptInvite(inviteCode, inviteType)
        let pendingCampaigns: string[] = []

        if (result.success && result.legacyAcquisition) {
            pendingCampaigns = settleAcceptedInviteAcquisition(result.legacyAcquisition, result.claims).pending
            if (pendingCampaigns.length > 0) {
                captureException(new Error('accept-time legacy acquisition retained for retry'), {
                    tags: { error_type: 'invite_accept_campaign_retryable' },
                    extra: { inviteCode, pendingCampaigns, claims: result.claims },
                })
            }

            if (!result.onboardingResolved) {
                clearInvite()
                return { status: 'campaign_only', inviteCode, inviteType, result, pendingCampaigns }
            }
        }

        if (result.success && result.onboardingResolved) {
            posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
                invite_code: inviteCode,
                invite_type: inviteType,
            })
            clearInvite()
            return { status: 'attributed', inviteCode, inviteType, result, pendingCampaigns }
        }

        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
            invite_code: inviteCode,
            error_message: result.success ? 'Invite did not resolve onboarding' : 'API returned unsuccessful',
        })
        captureException(new Error('authenticated invite attribution unresolved'), {
            tags: { error_type: 'invite_accept_failed' },
            extra: { inviteCode, result },
        })
        extendInviteForRetry(30)
        return { status: 'retryable', inviteCode, inviteType, result, pendingCampaigns }
    } catch (error) {
        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
            invite_code: inviteCode,
            error_message: String(error),
        })
        captureException(error, {
            tags: { error_type: 'invite_accept_failed' },
            extra: { inviteCode },
        })
        extendInviteForRetry(30)
        return { status: 'retryable', inviteCode, inviteType }
    }
}
