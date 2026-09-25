'use client'

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
import GettingStartedChecklist from '@/components/Home/GettingStartedChecklist'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { REGION_RESTRICTED_CTA_HREF } from '@/components/Kyc/KycRegionRestrictedContent'
import { useAuth } from '@/context/authContext'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useProviderRejection } from '@/hooks/useProviderRejection'
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
    const { user } = useAuth()
    const { isRegionRestricted } = useIdentityVerification()
    const residenceRestrictions = useResidenceRestrictions()

    const {
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
    } = useProviderRejection(onboarding)

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
