'use client'

import { type ReactNode } from 'react'
import type { StaticImageData } from 'next/image'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Section } from '@/components/0_Bruddle/Section'
import { type IconName } from '@/components/Global/Icons/Icon'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import ActivationCTAs from '@/components/Home/ActivationCTAs'
import { type ActivationStep } from '@/hooks/useActivationStatus'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
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
    icon: IconName
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
        icon: 'qr-code',
        iconContainerClassName: 'bg-action-secondary',
        iconSize: 16,
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
        icon: 'qr-code',
        iconContainerClassName: 'bg-action-secondary',
        iconSize: 16,
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
        label: 'Invite friends (logo variant)',
        icon: 'invite-heart',
        logo: STAR_STRAIGHT_ICON,
        logoSize: 30,
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

// Each activation-funnel step (one CTA shown at a time on the real home screen).
const ACTIVATION_STEPS: { step: Exclude<ActivationStep, 'completed'>; label: string }[] = [
    { step: 'verify', label: "STEPS.verify — 'Unlock payments'" },
    { step: 'deposit', label: "STEPS.deposit — 'Deposit'" },
    { step: 'card', label: "STEPS.card — 'Get your card' (dismissable)" },
    { step: 'outbound', label: "STEPS.outbound — 'Make your first payment'" },
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

                {/* Activation funnel steps */}
                <Section title="Activation funnel steps (ActivationCTAs)" className="gap-4">
                    {ACTIVATION_STEPS.map(({ step, label }) => (
                        <div key={step} className="flex flex-col gap-2">
                            <p className="text-body-xs text-foreground-secondary">{label}</p>
                            <ActivationCTAs
                                activationStep={step}
                                onDismissCard={step === 'card' ? noop('dismiss card step') : undefined}
                            />
                        </div>
                    ))}
                </Section>

                <Callout priority="info" title="Preview behavior">
                    Activation steps read defensive hooks (useCapabilities / useIdentityVerification) that return empty
                    defaults when logged out, so every step renders here regardless of real KYC state — except the spend
                    step, which needs card access or a QR rail to have an activating spend to route to, and so stays
                    empty in a logged-out preview.
                </Callout>
            </div>
        </DevPageShell>
    )
}
