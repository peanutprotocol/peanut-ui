'use client'

import { railUserMessage, railVerdict } from '@/utils/capability-gate'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { Button } from '@/components/0_Bruddle/Button'
import { type OnboardingState } from '@/utils/activation-step.utils'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useRouter } from 'next/navigation'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { useModalsContext } from '@/context/ModalsContext'
import Card from '../Global/Card'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useCapabilities } from '@/hooks/useCapabilities'
import GettingStartedChecklist from '@/components/Home/GettingStartedChecklist'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { useCardSurfaceAccess } from '@/hooks/useCardSurfaceAccess'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { REGION_RESTRICTED_CTA_HREF } from '@/components/Kyc/KycRegionRestrictedContent'
import { useAuth } from '@/context/authContext'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'

interface ActivationCTAsProps {
    onboarding: OnboardingState
}

interface StepConfig {
    /** a product concept's step spreads CONCEPT_ICONS; verification and account steps are blue (TASK-22761) */
    bubble: { icon: IconName; color: IconBubbleColor }
    title: string
    description: string
    ctaLabel: string
    href: string
}

/**
 * The Home slot before the first payment: the getting-started checklist, or —
 * when a door on it is shut — the one card that says why. Region restriction
 * outranks everything; a provider rejection replaces the checklist for a
 * verified user with no other way to move money.
 */
export default function ActivationCTAs({ onboarding }: ActivationCTAsProps) {
    const t = useTranslations('home.activation')
    const tIdentity = useTranslations('identity')
    const tRegion = useTranslations('kyc.regionRestricted')
    const tProviderRejection = useTranslations('profile.regions.providerRejection')
    const router = useRouter()
    const { openSupportWithMessage } = useModalsContext()
    const { rails, channelOf, nextActions } = useCapabilities()
    const { user } = useAuth()
    // canSpendPathViaCard, not showCardSurface: a prohibited residence with
    // only a pending application keeps the /card surface to watch its status,
    // but a card path would promise a card that cannot issue. The Home
    // card-prompt kill switch mutes it; /card itself stays available.
    const { canSpendPathViaCard } = useCardSurfaceAccess()
    const canApplyForCard = underMaintenanceConfig.disableCardPromotion ? false : canSpendPathViaCard
    const { isRegionRestricted } = useIdentityVerification()
    const residenceRestrictions = useResidenceRestrictions()

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

    // Known reason codes render localized identity.reasons.* copy; unknown
    // codes keep the backend's display-ready prose as fallback.
    const primaryRejectionReasonKey = reasonCodeKey(primaryRejectionCode)
    const localizedRejectionMessage = primaryRejectionReasonKey
        ? tIdentity(primaryRejectionReasonKey)
        : primaryRejectionMessage

    const [showProvideEmail, setShowProvideEmail] = useState(false)

    // Inline self-heal so the home "Upload document" CTA opens the Sumsub document
    // re-upload directly, instead of routing to /profile/accounts-and-payments (which
    // only showed the regions list, forcing the user to hunt for the Upload-document
    // CTA again). Mirrors the add-money bank flow + the Unlock payments view.
    const kycFlow = useMultiPhaseKycFlow({})

    // Each onboarding step is reported once per session, not on every Home visit.
    const userId = user?.user?.userId
    useEffect(() => {
        const step = onboarding.step
        if (step === 'completed' || !userId) return
        const key = `peanut_activation_step_viewed:${userId}:${step}`
        try {
            if (sessionStorage.getItem(key)) return
            sessionStorage.setItem(key, '1')
        } catch {}
        posthog.capture(ANALYTICS_EVENTS.ACTIVATION_STEP_VIEWED, { step })
    }, [onboarding.step, userId])

    // A user who can already transact — they hold an active card (its rail reads
    // `enabled`), have any other enabled rail, or the BE has marked them
    // activated — is NOT mid-activation. A rejected *bank* rail is then an
    // optional extra capability, not a setup blocker, so the home activation CTA
    // must stand down. A genuinely-fixable bank RFI still surfaces in context in
    // the /add-money bank flow (which runs its own gate). Without this, a
    // card-holder with a dead/rejected bank rail gets nagged with "Complete your
    // setup" on a rail they can't — and needn't — fix.
    const canAlreadyTransact = useMemo(
        () => rails.some((rail) => rail.status === 'enabled') || (user?.user?.isActivated ?? false),
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

    const step: StepConfig | null = useMemo(() => {
        // Highest precedence, ahead of the checklist AND every provider
        // rejection: a region-restricted user can never pass "Verify identity",
        // so the list would nag them indefinitely. Replace it with the
        // explanation and point them at what still works.
        if (isRegionRestricted) {
            return {
                bubble: { icon: 'globe-lock', color: 'blue' },
                title: tRegion('title'),
                description: tRegion('homeDescription'),
                ctaLabel: tRegion('cta'),
                href: REGION_RESTRICTED_CTA_HREF,
            }
        }

        if (hasProviderRejection) {
            // Email-blocked (status=blocked) outranks a fixable RFI (status=requires-info)
            // — the canonical `deriveGate` order, and the order this card's onClick
            // already follows (isEmailBlocked first). Ranking fixable above email here
            // made the copy say "Upload document" while the button opened the email
            // sheet, and hid the document-upload path entirely when both coexisted.
            if (isEmailBlocked) {
                return {
                    bubble: { icon: 'globe-lock', color: 'blue' },
                    title: t('addEmail.title'),
                    description: localizedRejectionMessage || t('addEmail.description'),
                    ctaLabel: t('addEmail.cta'),
                    href: '', // handled in onClick
                }
            }
            if (hasFixableRejection) {
                return {
                    bubble: { icon: 'globe-lock', color: 'blue' },
                    title: t('completeSetup.title'),
                    description: localizedRejectionMessage || t('completeSetup.description'),
                    ctaLabel: t('completeSetup.cta'),
                    href: '/profile/accounts-and-payments',
                }
            }
            // Blocked, but self-fixable by verifying again with a document that
            // carries what the provider needs — a Brazilian whose ID has no CPF is
            // the case this exists for. Offering support here contradicts a restart
            // endpoint that already admits them.
            //
            // Copy comes from the profile catalog rather than a second `home.*`
            // key: the strings would be identical, and the catalog drift test asks
            // for one canonical key instead of two that can diverge.
            if (isRestartBlocked) {
                return {
                    bubble: { icon: 'globe-lock', color: 'blue' },
                    title: tProviderRejection('restartTitle'),
                    description: localizedRejectionMessage || tProviderRejection('restartDescription'),
                    ctaLabel: tProviderRejection('restartTitle'),
                    href: '', // handled in onClick
                }
            }
            // blocked
            return {
                bubble: { icon: 'globe-lock', color: 'blue' },
                title: t('verificationIssue.title'),
                description: t('verificationIssue.description'),
                ctaLabel: t('verificationIssue.cta'),
                href: '', // handled in onClick
            }
        }

        return null
    }, [
        t,
        hasProviderRejection,
        hasFixableRejection,
        isEmailBlocked,
        isRestartBlocked,
        localizedRejectionMessage,
        isRegionRestricted,
        tRegion,
        tProviderRejection,
    ])

    if (onboarding.step === 'completed' && !step) return null

    // A fully restricted residence (no bank rails AND no card) has nothing
    // behind "Verify identity" — the ID check could only end on a terminal
    // rejection, so the list would offer doors that cannot open.
    if (!step && onboarding.verify === 'todo' && residenceRestrictions.banking && residenceRestrictions.card) {
        return null
    }

    if (!step) return <GettingStartedChecklist onboarding={onboarding} />

    return (
        <Card position="solo" className="p-0">
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-6">
                <IconBubble {...step.bubble} />
                <div className="w-full text-center">
                    <div className="text-heading-card">{step.title}</div>
                    <div className="text-body-s text-foreground-secondary">{step.description}</div>
                </div>
                <Button
                    variant="primary"
                    shadowSize="4"
                    className="mt-2 w-full"
                    onClick={() => {
                        // Mirror the step-precedence above: whatever else is true
                        // of this user's rails, the region card's CTA must just
                        // navigate — never open support, never start a Sumsub flow.
                        if (isRegionRestricted) {
                            router.push(REGION_RESTRICTED_CTA_HREF)
                        } else if (isEmailBlocked) {
                            setShowProvideEmail(true)
                        } else if (hasProviderRejection && isRestartBlocked && !hasFixableRejection) {
                            // Self-fixable by a fresh ID check, so it must not open
                            // support — same rank as the terminal arm below, only a
                            // different destination.
                            void kycFlow.handleRestartIdentity()
                        } else if (hasProviderRejection && hasBlockedRejection && !hasFixableRejection) {
                            // REQUIRES_SUPPORT class (or any blocked rail) — pre-fill Crisp
                            // with the failure context so support can dispatch without
                            // re-investigating the user's state.
                            openSupportWithMessage(
                                buildContactSupportMessage({
                                    reason: blockedRail?.reason,
                                    railId: blockedRail?.id,
                                    userId: user?.user?.userId,
                                })
                            )
                        } else if (hasProviderRejection && hasFixableRejection && fixableProvider) {
                            void kycFlow.handleFixableRejection({
                                provider: fixableProvider,
                                actionKey: fixableActionKey,
                                // The handler routes a residence park to start-action
                                // and everything else to resubmit, and the code is the
                                // only thing that tells them apart. `emailBlocked` is
                                // falsy in this branch, so the memo's precedence makes
                                // this the fixable rail's own code.
                                reasonCode: primaryRejectionCode,
                            })
                        } else {
                            router.push(step.href)
                        }
                    }}
                >
                    {step.ctaLabel}
                </Button>
            </div>
            <ProvideEmailStep
                visible={showProvideEmail}
                onComplete={() => setShowProvideEmail(false)}
                onSkip={() => setShowProvideEmail(false)}
            />
            <SumsubKycModals flow={kycFlow} />
        </Card>
    )
}
