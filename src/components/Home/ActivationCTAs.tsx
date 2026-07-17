'use client'

import { railUserMessage, railVerdict } from '@/utils/capability-gate'
import { Button } from '@/components/0_Bruddle/Button'
import { type ActivationStep } from '@/hooks/useActivationStatus'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { useRouter } from 'next/navigation'
import { useModalsContext } from '@/context/ModalsContext'
import Card from '../Global/Card'
import CardLaunchCTABanner from '@/components/Home/CardLaunchCTA/CardLaunchCTABanner'
import { useEffect, useMemo, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { useAuth } from '@/context/authContext'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'

interface ActivationCTAsProps {
    activationStep: ActivationStep
    /** Dismisses the card step (persists locally). Only relevant for step='card'. */
    onDismissCard?: () => void
}

interface StepConfig {
    icon: IconName
    iconBg: string
    title: string
    description: string
    ctaLabel: string
    href: string
    dismissable?: boolean
}

const STEPS: Record<Exclude<ActivationStep, 'completed'>, StepConfig> = {
    verify: {
        icon: 'globe-lock',
        iconBg: 'bg-primary-1',
        title: 'Unlock payments',
        description: 'Bank deposits, QR codes, and local payment methods',
        ctaLabel: 'Unlock now',
        href: '/profile/identity-verification',
    },
    deposit: {
        icon: 'arrow-down',
        iconBg: 'bg-primary-1',
        title: 'Deposit',
        description: 'Add money to make your first payment',
        ctaLabel: 'Add money',
        href: '/add-money',
    },
    card: {
        icon: 'credit-card',
        iconBg: 'bg-yellow-1',
        title: 'Spend anywhere Visa is accepted',
        description: 'Use your balance at 150M+ merchants. Online, contactless.',
        ctaLabel: 'Get your card',
        href: '/card',
        dismissable: true,
    },
    outbound: {
        icon: 'qr-code',
        iconBg: 'bg-primary-1',
        title: 'Make your first payment',
        description: 'Start paying to Pix and MercadoPago QR codes',
        ctaLabel: 'Start Spending',
        href: '/send',
    },
}

/**
 * single activation CTA for non-activated users on the home screen.
 * shows only the current step the user needs to complete.
 * when sumsub is approved but a provider rejected the user, overrides
 * the deposit/outbound step with a "complete your setup" message.
 */
export default function ActivationCTAs({ activationStep, onDismissCard }: ActivationCTAsProps) {
    const router = useRouter()
    const { setIsQRScannerOpen, openSupportWithMessage } = useModalsContext()
    const { rails, channelOf, nextActions } = useCapabilities()
    const { user } = useAuth()
    // Suppress the "Unlock payments" verify CTA while identity is mid-flight
    // (Sumsub processing / action_required). The user already took the verify
    // action; the identity-verification page surfaces the in-progress modal,
    // and bouncing them through here again would imply they need to re-act.
    const { isProcessing: isIdentityProcessing, needsAction: isIdentityActionRequired } = useIdentityVerification()

    // The activation funnel gates deposit/outbound, which routes through bank or
    // qr-only channels — never through card. Top-level status (not per-op
    // refinement): Manteca's pool tier reads `enabled` at the rail level even when
    // deposit/withdraw individually need an upgrade — that's not a rejection.
    const {
        hasFixableRejection,
        fixableProvider,
        hasBlockedRejection,
        primaryRejectionMessage,
        blockedRail,
        isEmailBlocked,
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
        return {
            hasFixableRejection: !!fixableRail,
            fixableProvider:
                fixableRail && (fixableRail.provider === 'bridge' || fixableRail.provider === 'manteca')
                    ? (fixableRail.provider.toUpperCase() as 'BRIDGE' | 'MANTECA')
                    : null,
            hasBlockedRejection: !!blocked,
            // Same precedence the copy/onClick use: email-blocked → fixable → terminal.
            primaryRejectionMessage: (() => {
                const surfaced = emailBlocked ?? fixableRail ?? blocked
                return surfaced ? railUserMessage(surfaced) : null
            })(),
            blockedRail: blocked,
            isEmailBlocked: !!emailBlocked,
        }
    }, [rails, channelOf, nextActions])

    const [showProvideEmail, setShowProvideEmail] = useState(false)

    // Inline self-heal so the home "Upload document" CTA opens the Sumsub document
    // re-upload directly, instead of routing to /profile/identity-verification (which
    // only showed the regions list, forcing the user to hunt for the Upload-document
    // CTA again). Mirrors the add-money bank flow + UnlockedRegions view.
    const kycFlow = useMultiPhaseKycFlow({})

    const lastTrackedStep = useRef<ActivationStep | null>(null)
    useEffect(() => {
        if (activationStep !== 'completed' && activationStep !== lastTrackedStep.current) {
            lastTrackedStep.current = activationStep
            posthog.capture(ANALYTICS_EVENTS.ACTIVATION_STEP_VIEWED, {
                step: activationStep,
            })
        }
    }, [activationStep])

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

    // provider rejection overrides the step copy when user is past the verify step
    // (sumsub approved but provider rejected — deposit/outbound CTAs are useless),
    // UNLESS they can already transact via card / another rail (see above).
    const hasProviderRejection =
        activationStep !== 'verify' &&
        activationStep !== 'card' &&
        !canAlreadyTransact &&
        (hasFixableRejection || hasBlockedRejection)

    const step: StepConfig | null = useMemo(() => {
        if (activationStep === 'completed' && !hasProviderRejection) return null

        // Hide the verify CTA while identity is processing — user already
        // submitted, the BE is reviewing, no further action from them.
        // action_required is the exception: that means we DO need them back.
        if (activationStep === 'verify' && isIdentityProcessing && !isIdentityActionRequired) return null

        if (hasProviderRejection) {
            // Email-blocked (status=blocked) outranks a fixable RFI (status=requires-info)
            // — the canonical `deriveGate` order, and the order this card's onClick
            // already follows (isEmailBlocked first). Ranking fixable above email here
            // made the copy say "Upload document" while the button opened the email
            // sheet, and hid the document-upload path entirely when both coexisted.
            if (isEmailBlocked) {
                return {
                    icon: 'globe-lock',
                    iconBg: 'bg-primary-1',
                    title: 'Add your email',
                    description:
                        primaryRejectionMessage || 'We need an email address to finish setting up your account.',
                    ctaLabel: 'Add email',
                    href: '', // handled in onClick
                }
            }
            if (hasFixableRejection) {
                return {
                    icon: 'globe-lock',
                    iconBg: 'bg-primary-1',
                    title: 'Complete your setup',
                    description: primaryRejectionMessage || 'We need an updated document before you can add money.',
                    ctaLabel: 'Upload document',
                    href: '/profile/identity-verification',
                }
            }
            // blocked
            return {
                icon: 'globe-lock',
                iconBg: 'bg-primary-1',
                title: 'Verification issue',
                description: 'Contact support for help with your verification.',
                ctaLabel: 'Contact support',
                href: '', // handled in onClick
            }
        }

        return STEPS[activationStep as Exclude<ActivationStep, 'completed'>]
    }, [
        activationStep,
        hasProviderRejection,
        hasFixableRejection,
        isEmailBlocked,
        primaryRejectionMessage,
        isIdentityProcessing,
        isIdentityActionRequired,
    ])

    if (!step) return null

    // The card step renders the mysterious /shhhhh-tone launch banner (#2295's
    // CardLaunchCTABanner) instead of the plain funnel card — so non-activated
    // card-eligible users get the same CTA as the activated launch splash.
    // Keeps the funnel's /card routing + the "Maybe later" dismissal.
    if (activationStep === 'card') {
        return (
            <CardLaunchCTABanner
                onTryDoor={() => {
                    posthog.capture(ANALYTICS_EVENTS.CARD_LAUNCH_CTA_CLICKED)
                    // /shhhhh (not /card): the landing page explains the feature
                    // and funnels into the canonical flow — /card alone is confusing.
                    router.push('/shhhhh')
                }}
                onDismiss={() => onDismissCard?.()}
            />
        )
    }

    return (
        <Card position="single" className="p-0">
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-6">
                <div className={`flex size-12 items-center justify-center rounded-full ${step.iconBg}`}>
                    <Icon name={step.icon} size={24} />
                </div>
                <div className="w-full text-center">
                    <div className="text-lg font-bold">{step.title}</div>
                    <div className="text-sm text-grey-1">{step.description}</div>
                </div>
                <Button
                    variant="purple"
                    shadowSize="4"
                    className="mt-2 w-full"
                    onClick={() => {
                        if (isEmailBlocked) {
                            setShowProvideEmail(true)
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
                            void kycFlow.handleSelfHealResubmit(fixableProvider)
                        } else if (activationStep === 'outbound' && !hasProviderRejection) {
                            setIsQRScannerOpen(true)
                        } else {
                            router.push(step.href)
                        }
                    }}
                >
                    {step.ctaLabel}
                </Button>
                {step.dismissable && onDismissCard && (
                    <button type="button" onClick={onDismissCard} className="text-sm font-medium text-black underline">
                        Maybe later
                    </button>
                )}
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
