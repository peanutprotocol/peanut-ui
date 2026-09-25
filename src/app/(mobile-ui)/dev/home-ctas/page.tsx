'use client'

import { type ReactNode } from 'react'
import type { StaticImageData } from 'next/image'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Section } from '@/components/0_Bruddle/Section'
import { type IconName } from '@/components/Global/Icons/Icon'
import type { Concept } from '@/components/0_Bruddle/conceptIcons'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import ActivationCTAs from '@/components/Home/ActivationCTAs'
import { type OnboardingState } from '@/utils/activation-step.utils'
import DevPageShell from '../_components/DevPageShell'

/**
 * /dev/home-ctas — force-renders every home-screen CTA in isolation so they can
 * be reviewed visually on demand, ignoring real auth/state/launch gating.
 *
 * Each CTA's container (HomeCarouselCTA/index,
 * ActivationCTAs' parent) self-gates and would return null. This page renders
 * the *presentational* pieces directly with mock props, so what's below is the
 * full visual catalogue regardless of who's logged in.
 *
 * Handlers are wired to no-op console.logs — nothing here navigates or mutates.
 */

const noop = (label: string) => () => console.log(`[dev/home-ctas] ${label}`)

// Representative carousel CTAs, mirroring the variants built in
// useHomeCarouselCTAs + the Card Pioneer perk-claim path in HomeCarouselCTA.
type CarouselPreview = {
    id: string
    label: string
    icon?: IconName
    concept?: Concept
    title: ReactNode
    description: ReactNode
    iconContainerClassName?: string
    iconSize?: number
    logo?: StaticImageData
    logoSize?: number
    mascotPose?: MascotPose
}

const CAROUSEL_PREVIEWS: CarouselPreview[] = [
    {
        id: 'qr-payment',
        label: 'QR payment nudge (KYC-approved user)',
        concept: 'qrPay',
        title: (
            <span>
                Pay with <b>QR code payments</b>
            </span>
        ),
        description: (
            <span>
                Get the best exchange rate, pay like a <b>local</b> and earn <b>rewards</b>.
            </span>
        ),
    },
    {
        id: 'kyc-prompt',
        label: 'KYC prompt — unlock QR (un-verified user)',
        concept: 'qrPay',
        title: (
            <span>
                Unlock <b>QR code payments</b>
            </span>
        ),
        description: (
            <span>
                Confirm your ID to pay with <b>Mercado Pago</b> and <b>PIX</b> QR codes
            </span>
        ),
    },
    {
        id: 'invite-friends',
        label: 'Invite friends (rewards concept)',
        concept: 'rewards',
        title: 'Invite friends. Earn rewards',
        description: 'Earn rewards every time your friends use Peanut.',
    },
    {
        id: 'user-interview',
        label: 'User-interview invite (flag-gated campaign, mascot variant)',
        icon: 'peanut-support',
        mascotPose: 'waving-hello',
        iconContainerClassName: 'size-11',
        title: 'Help shape Peanut',
        description: "You're one of our most active users. Book a 15-min call with the team.",
    },
    {
        id: 'bug-bounty',
        label: 'Bug bounty',
        icon: 'bug',
        iconContainerClassName: 'bg-action-primary',
        iconSize: 20,
        title: (
            <span>
                Help us improve and <b>get $5!</b>
            </span>
        ),
        description: 'Be the first to report a bug. Get rewarded!',
    },
    {
        id: 'notification-prompt',
        label: 'Callout prompt',
        icon: 'bell',
        title: 'Stay in the loop!',
        description: 'Turn on notifications and get alerts for all your wallet activity.',
    },
]

// The getting-started checklist in each onboarding state (resolveOnboarding).
const ONBOARDING_STATES: { label: string; onboarding: OnboardingState }[] = [
    {
        label: 'New user — verify next',
        onboarding: {
            verify: 'todo',
            addMoneyDone: false,
            firstPaymentDone: false,
            firstPaymentRoute: 'card_qr',
            step: 'verify',
        },
    },
    {
        label: 'ID check in review — add money next (card only)',
        onboarding: {
            verify: 'in_review',
            addMoneyDone: false,
            firstPaymentDone: false,
            firstPaymentRoute: 'card',
            step: 'add_money',
        },
    },
    {
        label: 'Money in before the ID check, no card or QR (three rows) — verify next',
        onboarding: {
            verify: 'todo',
            addMoneyDone: true,
            firstPaymentDone: false,
            firstPaymentRoute: 'none',
            step: 'verify',
        },
    },
    {
        label: 'Verified, $0 — add money next (QR only)',
        onboarding: {
            verify: 'done',
            addMoneyDone: false,
            firstPaymentDone: false,
            firstPaymentRoute: 'qr',
            step: 'add_money',
        },
    },
    {
        label: 'Verified and funded — first payment next (card and QR: opens the chooser)',
        onboarding: {
            verify: 'done',
            addMoneyDone: true,
            firstPaymentDone: false,
            firstPaymentRoute: 'card_qr',
            step: 'first_payment',
        },
    },
]

export default function HomeCTAsPreviewPage() {
    return (
        <DevPageShell
            title="Home CTAs"
            description="Every home-screen CTA, force-rendered in isolation — no auth, state, or launch gating. Handlers are no-op console.logs."
            width="prose"
        >
            <div className="flex flex-col gap-8">
                {/* Carousel CTAs */}
                <Section title="Carousel CTAs (CarouselCTA)" className="gap-4">
                    {CAROUSEL_PREVIEWS.map((cta) => (
                        <div key={cta.id} className="flex flex-col gap-2">
                            <p className="text-body-xs text-foreground-secondary">{cta.label}</p>
                            <CarouselCTA
                                title={cta.title}
                                description={cta.description}
                                icon={cta.icon}
                                concept={cta.concept}
                                iconContainerClassName={cta.iconContainerClassName}
                                iconSize={cta.iconSize}
                                logo={cta.logo}
                                mascotPose={cta.mascotPose}
                                logoSize={cta.logoSize}
                                onClose={noop(`close ${cta.id}`)}
                                onClick={noop(`click ${cta.id}`)}
                            />
                        </div>
                    ))}
                </Section>

                {/* Getting-started checklist states */}
                <Section title="Getting-started checklist (ActivationCTAs)" className="gap-4">
                    {ONBOARDING_STATES.map(({ label, onboarding }) => (
                        <div key={label} className="flex flex-col gap-2">
                            <p className="text-body-xs text-foreground-secondary">{label}</p>
                            <ActivationCTAs onboarding={onboarding} />
                        </div>
                    ))}
                </Section>

                <Callout priority="info" title="Preview behavior">
                    The checklist reads defensive hooks (useCapabilities / useIdentityVerification) that return empty
                    defaults when logged out, so every state renders here regardless of real KYC state.
                </Callout>
            </div>
        </DevPageShell>
    )
}
