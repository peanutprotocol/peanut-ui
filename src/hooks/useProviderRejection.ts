'use client'

import underMaintenanceConfig from '@/config/underMaintenance.config'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useCardSurfaceAccess } from '@/hooks/useCardSurfaceAccess'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { IDENTITY_REGION_RESTRICTED_CODE } from '@/constants/kyc.consts'
import { type BlockedCardKind, blockedCardCtaId } from '@/utils/home-carousel.utils'
import { type OnboardingState, canAlreadyTransact as canTransactOn } from '@/utils/activation-step.utils'
import { railUserMessage, railVerdict } from '@/utils/capability-gate'
import { useMemo } from 'react'

/** dismissal-key code for a final ID-check decision the API gave no reason code for */
const IDENTITY_FAILED_CODE = 'identity_failed'

/**
 * Whether a bank or QR provider rejection should replace the Home checklist,
 * and which one. HomePage reads it too: a user whose checklist is otherwise
 * done (no card, no QR rail, verified, funded) still sees the rejection card
 * instead of the carousel.
 *
 * `blockedCard` names the one blocked card Home would show (region refusal
 * first, then the rejection kinds in the card's own order) and its dismissal
 * key, so HomePage and ActivationCTAs agree on what "Hide" hides.
 */
export function useProviderRejection(onboarding: OnboardingState) {
    const { rails, channelOf, nextActions } = useCapabilities()
    const { user } = useAuth()
    // canSpendPathViaCard, not showCardSurface: a prohibited residence with
    // only a pending application keeps the /card surface to watch its status,
    // but a card path would promise a card that cannot issue. The Home
    // card-prompt kill switch mutes it; /card itself stays available.
    const { canSpendPathViaCard } = useCardSurfaceAccess()
    const canApplyForCard = underMaintenanceConfig.disableCardPromotion ? false : canSpendPathViaCard

    // The activation funnel gates deposit/outbound, which routes through bank or
    // qr-only channels — never through card. Top-level status (not per-op
    // refinement): Manteca's pool tier reads `enabled` at the rail level even when
    // deposit/withdraw individually need an upgrade — that's not a rejection.
    const {
        hasFixableRejection,
        fixableProvider,
        fixableActionKey,
        hasBlockedRejection,
        primaryRejectionMessage,
        primaryRejectionCode,
        blockedRail,
        isEmailBlocked,
        isRestartBlocked,
    } = useMemo(() => {
        const rejectableRails = rails.filter((rail) => {
            const channel = channelOf(rail)
            return channel === 'bank' || channel === 'qr-only'
        })
        // Verdict-first via the shared railVerdict collapse (rail.resolved,
        // BE-derived; legacy fallback for older/cached responses).
        const actionByKey = new Map(nextActions.map((action) => [action.key, action]))
        const isEmailFix = (rail: (typeof rejectableRails)[number]) =>
            railVerdict(rail, actionByKey).blocking?.selfHealKind === 'provide-email'
        const fixableRail = rejectableRails.find(
            (rail) => railVerdict(rail, actionByKey).status === 'fixable' && !isEmailFix(rail)
        )
        // Email-blocked rails: prefer one over an earlier blocked rail with a
        // terminal reason, since one email fixes them all.
        const emailBlocked = rejectableRails.find(isEmailFix)
        const blocked =
            emailBlocked ?? rejectableRails.find((rail) => railVerdict(rail, actionByKey).status === 'blocked')
        const fixableAction = fixableRail ? railVerdict(fixableRail, actionByKey).nextAction : undefined
        return {
            hasFixableRejection: !!fixableRail,
            fixableProvider:
                fixableRail && (fixableRail.provider === 'bridge' || fixableRail.provider === 'manteca')
                    ? (fixableRail.provider.toUpperCase() as 'BRIDGE' | 'MANTECA')
                    : null,
            fixableActionKey: fixableAction?.kind === 'sumsub' ? fixableAction.key : null,
            hasBlockedRejection: !!blocked,
            // Same precedence the copy/onClick use: email-blocked → fixable → terminal.
            primaryRejectionMessage: (() => {
                const surfaced = emailBlocked ?? fixableRail ?? blocked
                return surfaced ? railUserMessage(surfaced) : null
            })(),
            primaryRejectionCode: (() => {
                const surfaced = emailBlocked ?? fixableRail ?? blocked
                return surfaced ? (surfaced.reason?.code ?? surfaced.resolved?.blocking?.code ?? null) : null
            })(),
            blockedRail: blocked,
            isEmailBlocked: !!emailBlocked,
            // Read off the rail the blocked arm ALREADY selected, rather than
            // hunting for a restart-eligible rail among the blocked ones. That is
            // `deriveGate`'s rule verbatim: the FIRST blocked verdict decides, so
            // an account-wide terminal block still wins over a sibling's restart
            // CTA — re-verifying cannot lift a terminal rail and it burns the
            // user's Sumsub attempts.
            isRestartBlocked:
                !emailBlocked &&
                !!blocked &&
                railVerdict(blocked, actionByKey).blocking?.selfHealKind === 'restart-identity',
        }
    }, [rails, channelOf, nextActions])

    // A user who can already transact — they hold an active card (its rail reads
    // `enabled`), have any other enabled rail, or the BE has marked them
    // activated — is NOT mid-activation. A rejected *bank* rail is then an
    // optional extra capability, not a setup blocker, so the home activation CTA
    // must stand down. A genuinely-fixable bank RFI still surfaces in context in
    // the /add-money bank flow (which runs its own gate). Without this, a
    // card-holder with a dead/rejected bank rail gets nagged with "Complete your
    // setup" on a rail they can't — and needn't — fix.
    const canAlreadyTransact = useMemo(
        () => canTransactOn(rails, user?.user?.isActivated ?? false),
        [rails, user?.user?.isActivated]
    )

    // provider rejection replaces the checklist once identity is verified
    // (sumsub approved but provider rejected — the bank rows are useless),
    // UNLESS they can already transact via card / another rail (see above), or
    // they have a card PATH: a card-eligible user without a card doesn't need
    // the rejected bank rail to progress (crypto deposit → card), so nagging
    // them with "Contact support" over a rail the old region-picker detour
    // auto-enrolled would replace their useful deposit CTA with a dead end.
    // (This preserves the shielding the pre-2026-08-20 card-first step gave
    // this exact cohort; a fixable RFI still surfaces in the /add-money bank
    // flow, in context.)
    const hasCardPath = canApplyForCard === true
    const hasProviderRejection =
        onboarding.verify === 'done' &&
        !onboarding.firstPaymentDone &&
        !canAlreadyTransact &&
        !hasCardPath &&
        (hasFixableRejection || hasBlockedRejection)

    const { isRegionRestricted, identity } = useIdentityVerification()
    // The ID check ended on a final decision and the user moves money nowhere
    // (resolveOnboarding reads an enabled rail as done): the Verify row can
    // never finish, so the verification-issue card with contact support takes
    // the checklist's place, as the region card does.
    const hasIdentityFailure = onboarding.verify === 'failed' && !isRegionRestricted && !onboarding.firstPaymentDone
    const identityFailureCode = identity.reason?.code ?? IDENTITY_FAILED_CODE
    const blockedCard = useMemo((): { kind: BlockedCardKind; reasonCode: string | null; ctaId: string } | null => {
        const card = (kind: BlockedCardKind, reasonCode: string | null) => ({
            kind,
            reasonCode,
            ctaId: blockedCardCtaId(kind, reasonCode),
        })
        if (isRegionRestricted) return card('region-restricted', IDENTITY_REGION_RESTRICTED_CODE)
        if (hasIdentityFailure) return card('verification-issue', identityFailureCode)
        if (!hasProviderRejection) return null
        if (isEmailBlocked) return card('add-email', primaryRejectionCode)
        if (hasFixableRejection) return card('complete-setup', primaryRejectionCode)
        if (isRestartBlocked) return card('restart-identity', primaryRejectionCode)
        return card('verification-issue', primaryRejectionCode)
    }, [
        isRegionRestricted,
        hasIdentityFailure,
        identityFailureCode,
        hasProviderRejection,
        isEmailBlocked,
        hasFixableRejection,
        isRestartBlocked,
        primaryRejectionCode,
    ])

    return {
        blockedCard,
        hasIdentityFailure,
        hasProviderRejection,
        hasFixableRejection,
        fixableProvider,
        fixableActionKey,
        hasBlockedRejection,
        primaryRejectionMessage,
        primaryRejectionCode,
        blockedRail,
        isEmailBlocked,
        isRestartBlocked,
    }
}
