'use client'

import { railUserMessage, railVerdict } from '@/utils/capability-gate'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { Button } from '@/components/0_Bruddle/Button'
import { type ActivationStep } from '@/hooks/useActivationStatus'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { useRouter } from 'next/navigation'
import ActionModal from '@/components/Global/ActionModal'
import { useModalsContext } from '@/context/ModalsContext'
import Card from '../Global/Card'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useCapabilities } from '@/hooks/useCapabilities'
import GettingStartedChecklist from '@/components/Home/GettingStartedChecklist'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { REGION_RESTRICTED_CTA_HREF } from '@/components/Kyc/KycRegionRestrictedContent'
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

/**
 * single activation CTA for non-activated users on the home screen.
 * shows only the current step the user needs to complete.
 * when sumsub is approved but a provider rejected the user, overrides
 * the deposit/outbound step with a "complete your setup" message.
 */
export default function ActivationCTAs({ activationStep, onDismissCard }: ActivationCTAsProps) {
    const t = useTranslations('home.activation')
    const tCommon = useTranslations('common')
    const tIdentity = useTranslations('identity')
    const tRegion = useTranslations('kyc.regionRestricted')
    const router = useRouter()
    const { setIsQRScannerOpen, openSupportWithMessage } = useModalsContext()
    const { rails, channelOf, nextActions } = useCapabilities()
    const { user } = useAuth()
    // Card spend counts as activation too — card-access users get a card+QR
    // chooser on the outbound step instead of jumping straight to the scanner.
    // `undefined` while loading collapses to false → scanner behavior (never
    // tease the card to a user we can't confirm has access), which is also why
    // the scanner path must stand on its own QR-rail check below.
    const { hasCardAccess } = useCardInfo()
    // Suppress the "Unlock payments" verify CTA while identity is mid-flight
    // (Sumsub processing / action_required). The user already took the verify
    // action; the identity-verification page surfaces the in-progress modal,
    // and bouncing them through here again would imply they need to re-act.
    const {
        isProcessing: isIdentityProcessing,
        needsAction: isIdentityActionRequired,
        isRegionRestricted,
    } = useIdentityVerification()
    const residenceRestrictions = useResidenceRestrictions()

    // Activation is one of exactly two events (BE, GET /users/me): a card spend
    // authorization, or a Manteca QR pay on Pix / Mercado Pago. Send links,
    // direct sends, offramps and withdrawals are volume, not activation — so
    // the spend step is only honest while one of those two is open to the user.
    //
    // Keyed on the provider and the `pay` op, never on the channel: Pix is a
    // BANK-channel method that happens to carry `pay` (peanut-api-ts
    // METHOD_CHANNELS — MercadoPago is the only `qr-only` entry), and the QR
    // pool enables its rails one at a time, so a `qr-only` filter silently
    // drops every Brazilian user whose Pix pays but whose MercadoPago row did
    // not enable.
    //
    // `pay` must be present AND enabled — deliberately not `canDo`/
    // `operationStatus`, whose `operations.pay ?? status` fallback would read a
    // bank-only rail's missing `pay` as the rail's enabled status and hand it a
    // phantom QR capability. MANTECA_METHOD_OPERATIONS lists every op a method
    // supports (BANK_TRANSFER_AR is deposit+withdraw only), so on a rail that
    // carries the map an absent `pay` means "no merchant QR". The map is only
    // absent for an unknown method or a response predating it, where the
    // qr-only channel is pay by construction.
    const hasQrSpendRail = useMemo(
        () =>
            rails.some((rail) => {
                if (rail.provider !== 'manteca') return false
                if (rail.operations) return rail.operations.pay === 'enabled'
                return channelOf(rail) === 'qr-only' && rail.status === 'enabled'
            }),
        [rails, channelOf]
    )

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
        }
    }, [rails, channelOf, nextActions])

    // Known reason codes render localized identity.reasons.* copy; unknown
    // codes keep the backend's display-ready prose as fallback.
    const primaryRejectionReasonKey = reasonCodeKey(primaryRejectionCode)
    const localizedRejectionMessage = primaryRejectionReasonKey
        ? tIdentity(primaryRejectionReasonKey)
        : primaryRejectionMessage

    const [showProvideEmail, setShowProvideEmail] = useState(false)
    const [showSpendChooser, setShowSpendChooser] = useState(false)

    // If card access is revoked (or the card-info refetch flips it) while the
    // chooser is open, close it — a no-access user must never see the card option.
    useEffect(() => {
        if (hasCardAccess !== true) setShowSpendChooser(false)
    }, [hasCardAccess])

    const steps: Record<Exclude<ActivationStep, 'completed'>, StepConfig> = useMemo(
        () => ({
            verify: {
                icon: 'globe-lock',
                iconBg: 'bg-action-primary',
                title: t('steps.verify.title'),
                description: t('steps.verify.description'),
                ctaLabel: t('steps.verify.cta'),
                href: '/profile/identity-verification',
            },
            deposit: {
                icon: 'arrow-down',
                iconBg: 'bg-action-primary',
                title: t('steps.deposit.title'),
                description: t('steps.deposit.description'),
                ctaLabel: t('steps.deposit.cta'),
                href: '/add-money',
            },
            card: {
                icon: 'credit-card',
                iconBg: 'bg-action-secondary',
                title: t('steps.card.title'),
                description: t('steps.card.description'),
                ctaLabel: t('steps.card.cta'),
                href: '/card',
                dismissable: true,
            },
            outbound: {
                icon: 'qr-code',
                iconBg: 'bg-action-primary',
                title: t('steps.outbound.title'),
                description: t('steps.outbound.description'),
                ctaLabel: t('steps.outbound.cta'),
                href: '', // handled in onClick — card chooser or the QR scanner
            },
        }),
        [t]
    )

    // Inline self-heal so the home "Upload document" CTA opens the Sumsub document
    // re-upload directly, instead of routing to /profile/identity-verification (which
    // only showed the regions list, forcing the user to hunt for the Upload-document
    // CTA again). Mirrors the add-money bank flow + the Unlock payments view.
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
    // UNLESS they can already transact via card / another rail (see above), or
    // they have a card PATH: a card-eligible user without a card doesn't need
    // the rejected bank rail to progress (crypto deposit → card), so nagging
    // them with "Contact support" over a rail the old region-picker detour
    // auto-enrolled would replace their useful deposit CTA with a dead end.
    // (This preserves the shielding the pre-2026-08-20 card-first step gave
    // this exact cohort; a fixable RFI still surfaces in the /add-money bank
    // flow, in context.)
    const hasCardPath = hasCardAccess === true
    const hasProviderRejection =
        activationStep !== 'verify' &&
        activationStep !== 'card' &&
        !canAlreadyTransact &&
        !hasCardPath &&
        (hasFixableRejection || hasBlockedRejection)

    const step: StepConfig | null = useMemo(() => {
        // Highest precedence, ahead of every funnel step AND every provider
        // rejection: a region-restricted user can never finish the funnel, so
        // "Unlock payments" is a CTA that leads nowhere. They stay on 'verify'
        // forever (the milestone never advances past `registered`), which is
        // exactly the state that would nag them indefinitely. Replace the card
        // with the explanation and point them at what still works.
        if (isRegionRestricted) {
            return {
                icon: 'globe-lock',
                iconBg: 'bg-action-primary',
                title: tRegion('title'),
                description: tRegion('homeDescription'),
                ctaLabel: tRegion('cta'),
                href: REGION_RESTRICTED_CTA_HREF,
            }
        }

        if (activationStep === 'completed' && !hasProviderRejection) return null

        // Hide the verify CTA while identity is processing — user already
        // submitted, the BE is reviewing, no further action from them.
        // action_required is the exception: that means we DO need them back.
        if (activationStep === 'verify' && isIdentityProcessing && !isIdentityActionRequired) return null

        // A fully restricted residence (no bank rails AND no card) has nothing
        // behind "Unlock payments" — the ID check could only end on a terminal
        // rejection, so the offer itself is dishonest. Partial restrictions
        // keep the CTA: one half of the unlock still works.
        if (activationStep === 'verify' && residenceRestrictions.banking && residenceRestrictions.card) return null

        if (hasProviderRejection) {
            // Email-blocked (status=blocked) outranks a fixable RFI (status=requires-info)
            // — the canonical `deriveGate` order, and the order this card's onClick
            // already follows (isEmailBlocked first). Ranking fixable above email here
            // made the copy say "Upload document" while the button opened the email
            // sheet, and hid the document-upload path entirely when both coexisted.
            if (isEmailBlocked) {
                return {
                    icon: 'globe-lock',
                    iconBg: 'bg-action-primary',
                    title: t('addEmail.title'),
                    description: localizedRejectionMessage || t('addEmail.description'),
                    ctaLabel: t('addEmail.cta'),
                    href: '', // handled in onClick
                }
            }
            if (hasFixableRejection) {
                return {
                    icon: 'globe-lock',
                    iconBg: 'bg-action-primary',
                    title: t('completeSetup.title'),
                    description: localizedRejectionMessage || t('completeSetup.description'),
                    ctaLabel: t('completeSetup.cta'),
                    href: '/profile/identity-verification',
                }
            }
            // blocked
            return {
                icon: 'globe-lock',
                iconBg: 'bg-action-primary',
                title: t('verificationIssue.title'),
                description: t('verificationIssue.description'),
                ctaLabel: t('verificationIssue.cta'),
                href: '', // handled in onClick
            }
        }

        // Card-access users can activate by swiping too — broaden the QR-only
        // framing. Users without card access keep the QR copy untouched so we
        // never tease a card they can't get.
        if (activationStep === 'outbound' && hasCardAccess) {
            return {
                ...steps.outbound,
                icon: 'credit-card',
                title: t('spendWithPeanut.title'),
                description: t('spendWithPeanut.description'),
            }
        }

        return steps[activationStep as Exclude<ActivationStep, 'completed'>]
    }, [
        t,
        steps,
        activationStep,
        hasProviderRejection,
        hasFixableRejection,
        isEmailBlocked,
        localizedRejectionMessage,
        isIdentityProcessing,
        isIdentityActionRequired,
        residenceRestrictions,
        hasCardAccess,
        isRegionRestricted,
        tRegion,
    ])

    if (!step) return null

    // The 3-item checklist is the Home empty state (product decision,
    // TASK-22114): pre-funding it is the whole card slot; once money has moved
    // the activity list takes its place. Everything else falls through to the
    // single-step card below —
    //   • `outbound` / `card`: funded but NOT yet activated. Activation still
    //     needs a spend, so the one remaining step keeps a CTA. Dropping it
    //     stranded funded accounts with no route to the spend (and to Rewards).
    //   • provider rejections, email blocks, and the region-restricted
    //     explanation, which outranks the checklist: every step on the list is
    //     a door that user cannot open, so offering the list would be dishonest.
    const isFundedNotActivated = activationStep === 'outbound' || activationStep === 'card'
    if (!hasProviderRejection && !isRegionRestricted && !isFundedNotActivated) return <GettingStartedChecklist />

    // The spend step survives only while a spend that ACTIVATES is open: the
    // card (`/card`, or the chooser) or a QR pay. A funded user with neither
    // cannot clear this step at all — a peer send is volume, not activation —
    // so the card would reappear after every payment they make. They keep the
    // activity list instead.
    const canSpendToActivate = hasCardAccess === true || hasQrSpendRail
    if (activationStep === 'outbound' && !hasProviderRejection && !isRegionRestricted && !canSpendToActivate) {
        return null
    }

    return (
        <Card position="single" className="p-0">
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-6">
                <div className={`flex size-12 items-center justify-center rounded-full ${step.iconBg}`}>
                    <Icon name={step.icon} size={24} />
                </div>
                <div className="w-full text-center">
                    <div className="text-heading-card">{step.title}</div>
                    <div className="text-body-s text-foreground-secondary">{step.description}</div>
                </div>
                <Button
                    variant="purple"
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
                            })
                        } else if (activationStep === 'outbound' && !hasProviderRejection && hasCardAccess) {
                            posthog.capture(ANALYTICS_EVENTS.ACTIVATION_SPEND_CHOOSER_SHOWN)
                            setShowSpendChooser(true)
                        } else if (activationStep === 'outbound' && !hasProviderRejection) {
                            // No card, so the QR pay is this user's only
                            // activating spend — and the gate above already
                            // established they hold the rail for it.
                            setIsQRScannerOpen(true)
                        } else {
                            router.push(step.href)
                        }
                    }}
                >
                    {step.ctaLabel}
                </Button>
                {step.dismissable && onDismissCard && (
                    <button type="button" onClick={onDismissCard} className="text-body-s text-black underline">
                        {tCommon('maybeLater')}
                    </button>
                )}
            </div>
            <ProvideEmailStep
                visible={showProvideEmail}
                onComplete={() => setShowProvideEmail(false)}
                onSkip={() => setShowProvideEmail(false)}
            />
            <ActionModal
                visible={showSpendChooser && hasCardAccess === true}
                onClose={() => setShowSpendChooser(false)}
                icon="credit-card"
                title={t('spendChooser.title')}
                description={t('spendChooser.description')}
                ctas={[
                    {
                        text: t('spendChooser.payWithCard'),
                        shadowSize: '4',
                        onClick: () => {
                            posthog.capture(ANALYTICS_EVENTS.ACTIVATION_SPEND_CHOOSER_SELECTED, { choice: 'card' })
                            setShowSpendChooser(false)
                            router.push('/card')
                        },
                    },
                    {
                        text: t('spendChooser.scanQr'),
                        variant: 'stroke',
                        onClick: () => {
                            posthog.capture(ANALYTICS_EVENTS.ACTIVATION_SPEND_CHOOSER_SELECTED, { choice: 'qr' })
                            setShowSpendChooser(false)
                            setIsQRScannerOpen(true)
                        },
                    },
                ]}
            />
            <SumsubKycModals flow={kycFlow} />
        </Card>
    )
}
