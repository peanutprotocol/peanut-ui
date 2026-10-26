import posthog from 'posthog-js'
import { captureException } from '@/utils/sentry-lazy'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    bindInviteToUser,
    clearInviteIfOwnedBy,
    extendInviteForRetry,
    readInviteCode,
    readInviteType,
} from '@/utils/invite-stash'
import { settleAcceptedInviteAcquisition } from './invite-acquisition'
import { invitesApi, type AcceptInviteResult } from './invites'
import type { EInviteType } from './services.types'

export type PendingInviteAttributionOutcome = {
    status: 'none' | 'attributed' | 'campaign_only' | 'retryable' | 'terminal' | 'account_mismatch'
    inviteCode?: string
    inviteType?: EInviteType
    result?: AcceptInviteResult
    pendingCampaigns?: string[]
}

const inFlight = new Map<string, Promise<PendingInviteAttributionOutcome>>()
/**
 * The outcome that consumed each account's stash in this app session. The
 * auth provider usually settles first — registration hydrates the session,
 * then awaits other work — and an emptied stash must not make registration
 * report a successful referral as `none` (Chip review round 1).
 */
const consumedOutcomes = new Map<string, PendingInviteAttributionOutcome>()

/**
 * Registration settles once per account; a session start retries a durable
 * invite; the setup invite step settles an inviter typed after registration.
 */
export type InviteAttributionTrigger = 'registration' | 'session' | 'setup_invite_step'

/**
 * Records a stashed inviter after authentication. The invite stash is only
 * cleared after the API confirms either the immutable referral edge or a
 * terminal legacy campaign-only hand-off. Failures remain durable for the
 * next authenticated app start and never block open signup.
 *
 * Each call reports its outcome once, under its own trigger — registration
 * always, `none` included, so a lost hand-off shows up instead of leaving no
 * trace; a session start only when it found an invite (otherwise it is every
 * app launch). Registration and the auth provider usually race for the same
 * attempt, and both still report.
 */
export async function settlePendingInviteAttribution(
    userId: string,
    trigger: InviteAttributionTrigger = 'session'
): Promise<PendingInviteAttributionOutcome> {
    const shared = await settleShared(userId)
    const outcome =
        trigger === 'registration' && shared.status === 'none' ? (consumedOutcomes.get(userId) ?? shared) : shared
    if (trigger === 'registration' || outcome.status !== 'none') {
        try {
            // Enums only — never the code, which names the inviter.
            posthog.capture(ANALYTICS_EVENTS.INVITE_ATTRIBUTION_SETTLED, {
                trigger,
                status: outcome.status,
                ...(outcome.inviteType ? { invite_type: outcome.inviteType } : {}),
            })
        } catch {}
    }
    return outcome
}

function settleShared(userId: string): Promise<PendingInviteAttributionOutcome> {
    const inviteCode = readInviteCode().trim()
    if (!inviteCode) return Promise.resolve({ status: 'none' })
    if (!bindInviteToUser(userId)) return Promise.resolve({ status: 'account_mismatch', inviteCode })

    const attemptKey = `${userId}:${inviteCode}`
    const existing = inFlight.get(attemptKey)
    if (existing) return existing

    const attempt = settlePendingInviteAttributionOnce(userId, inviteCode).catch(
        (error): PendingInviteAttributionOutcome => {
            // Storage reads are expected to be safe, but attribution is
            // never allowed to turn a completed registration into a failed one.
            captureException(error, { tags: { error_type: 'invite_attribution_recovery_failed' } })
            return { status: 'retryable' }
        }
    )
    const trackedAttempt = attempt
        .then((outcome) => {
            // only outcomes that cleared the stash; a retryable one keeps it
            if (outcome.status !== 'retryable') consumedOutcomes.set(userId, outcome)
            return outcome
        })
        .finally(() => {
            if (inFlight.get(attemptKey) === trackedAttempt) inFlight.delete(attemptKey)
        })
    inFlight.set(attemptKey, trackedAttempt)
    return trackedAttempt
}

async function settlePendingInviteAttributionOnce(
    userId: string,
    inviteCode: string
): Promise<PendingInviteAttributionOutcome> {
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
                clearInviteIfOwnedBy(inviteCode, userId)
                return { status: 'campaign_only', inviteCode, inviteType, result, pendingCampaigns }
            }
        }

        if (result.success && result.onboardingResolved) {
            posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
                invite_code: inviteCode,
                invite_type: inviteType,
            })
            clearInviteIfOwnedBy(inviteCode, userId)
            return { status: 'attributed', inviteCode, inviteType, result, pendingCampaigns }
        }

        const retryable = !result.success && result.retryable
        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
            invite_code: inviteCode,
            error_message: retryable
                ? `Retryable invite failure${result.status ? ` (${result.status})` : ''}`
                : result.success
                  ? 'Invite did not resolve onboarding'
                  : `Terminal invite failure${result.status ? ` (${result.status})` : ''}`,
        })
        if (retryable) {
            captureException(new Error('authenticated invite attribution unresolved'), {
                tags: { error_type: 'invite_accept_failed' },
                extra: { inviteCode, result },
            })
            extendInviteForRetry(30, { inviteCode, userId })
            return { status: 'retryable', inviteCode, inviteType, result, pendingCampaigns }
        }

        clearInviteIfOwnedBy(inviteCode, userId)
        return { status: 'terminal', inviteCode, inviteType, result, pendingCampaigns }
    } catch (error) {
        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
            invite_code: inviteCode,
            error_message: String(error),
        })
        captureException(error, {
            tags: { error_type: 'invite_accept_failed' },
            extra: { inviteCode },
        })
        extendInviteForRetry(30, { inviteCode, userId })
        return { status: 'retryable', inviteCode, inviteType }
    }
}
