'use client'

import { type ReactNode } from 'react'
import type { StaticImageData } from 'next/image'
import NavHeader from '@/components/Global/NavHeader'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import CardLaunchCTABanner from '@/components/Home/CardLaunchCTA/CardLaunchCTABanner'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import ActivationCTAs from '@/components/Home/ActivationCTAs'
import { type ActivationStep } from '@/hooks/useActivationStatus'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'

/**
 * /dev/home-ctas — force-renders every home-screen CTA in isolation so they can
 * be reviewed visually on demand, ignoring real auth/state/launch gating.
 *
 * Each CTA's container (CardLaunchCTA/index, HomeCarouselCTA/index,
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
    isPerkClaim?: boolean
}

const CAROUSEL_PREVIEWS: CarouselPreview[] = [
    {
        id: 'perk-claim',
        label: 'Perk claim (pink-dot, no X) — Card Pioneer reward',
        icon: 'gift',
        iconContainerClassName: 'bg-primary-1',
        iconSize: 16,
        isPerkClaim: true,
        title: (
            <p>
                <b>+$5</b> reward ready!
            </p>
        ),
        description: (
            <p>
                <b>Alice</b> used Peanut. Tap to claim.
            </p>
        ),
    },
    {
        id: 'card-pioneer',
        label: 'Card Pioneer — get your Peanut Card',
        icon: 'credit-card',
        iconContainerClassName: 'bg-purple-1',
        iconSize: 16,
        title: (
            <span>
                Get your <b>Peanut Card</b>
            </span>
        ),
        description: (
            <span>
                Closed beta. <b>Badges skip the line.</b> $10 unlocks on your first $100 spend.
            </span>
        ),
    },
    {
        id: 'qr-payment',
        label: 'QR payment nudge (KYC-approved user)',
        icon: 'qr-code',
        iconContainerClassName: 'bg-secondary-1',
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
        iconContainerClassName: 'bg-secondary-1',
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
        id: 'bug-bounty',
        label: 'Bug bounty',
        icon: 'bug',
        iconContainerClassName: 'bg-primary-1',
        iconSize: 20,
        title: (
            <span>
                Help us improve and <b>get $5!</b>
            </span>
        ),
        description: 'Report a bug. Get rewarded! No questions asked.',
    },
    {
        id: 'notification-prompt',
        label: 'Notification prompt',
        icon: 'bell',
        title: 'Stay in the loop!',
        description: 'Turn on notifications and get alerts for all your wallet activity.',
    },
    {
        id: 'ios-pwa-install',
        label: 'iOS PWA install',
        icon: 'mobile-install',
        iconContainerClassName: 'bg-secondary-1',
        iconSize: 16,
        title: 'Add Peanut to your home screen',
        description: 'Follow a quick guide to add the app to your home screen, no download needed.',
    },
]

// Each activation-funnel step (one CTA shown at a time on the real home screen).
const ACTIVATION_STEPS: { step: Exclude<ActivationStep, 'completed'>; label: string }[] = [
    { step: 'verify', label: "STEPS.verify — 'Unlock payments'" },
    { step: 'deposit', label: "STEPS.deposit — 'Deposit'" },
    { step: 'card', label: "STEPS.card — 'Get your card' (dismissable)" },
    { step: 'outbound', label: "STEPS.outbound — 'Make your first payment'" },
]

function SectionLabel({ children }: { children: ReactNode }) {
    return <p className="text-xs font-bold uppercase tracking-wide text-grey-1">{children}</p>
}

export default function HomeCTAsPreviewPage() {
    return (
        <div className="flex min-h-[inherit] flex-col gap-6 pb-8">
            <div className="px-4 pt-4">
                <NavHeader title="Home CTAs" />
            </div>

            <div className="flex flex-col gap-8 px-4">
                <p className="text-sm text-grey-1">
                    Every home-screen CTA, force-rendered in isolation — no auth, state, or launch gating. Handlers are
                    no-op console.logs.
                </p>

                {/* Card launch banner */}
                <section className="flex flex-col gap-3">
                    <SectionLabel>Card launch banner (CardLaunchCTABanner)</SectionLabel>
                    <CardLaunchCTABanner onTryDoor={noop('onTryDoor')} onDismiss={noop('onDismiss')} />
                </section>

                {/* Carousel CTAs */}
                <section className="flex flex-col gap-4">
                    <SectionLabel>Carousel CTAs (CarouselCTA)</SectionLabel>
                    {CAROUSEL_PREVIEWS.map((cta) => (
                        <div key={cta.id} className="flex flex-col gap-1.5">
                            <p className="text-[11px] text-grey-1">{cta.label}</p>
                            <CarouselCTA
                                title={cta.title}
                                description={cta.description}
                                icon={cta.icon}
                                iconContainerClassName={cta.iconContainerClassName}
                                iconSize={cta.iconSize}
                                logo={cta.logo}
                                logoSize={cta.logoSize}
                                isPerkClaim={cta.isPerkClaim}
                                onClose={noop(`close ${cta.id}`)}
                                onClick={noop(`click ${cta.id}`)}
                            />
                        </div>
                    ))}
                </section>

                {/* Activation funnel steps */}
                <section className="flex flex-col gap-4">
                    <SectionLabel>Activation funnel steps (ActivationCTAs)</SectionLabel>
                    {ACTIVATION_STEPS.map(({ step, label }) => (
                        <div key={step} className="flex flex-col gap-1.5">
                            <p className="text-[11px] text-grey-1">{label}</p>
                            <ActivationCTAs
                                activationStep={step}
                                onDismissCard={step === 'card' ? noop('dismiss card step') : undefined}
                            />
                        </div>
                    ))}
                </section>

                <Card className="bg-primary-3/20 p-3">
                    <div className="mb-1 flex items-center gap-2">
                        <Icon name="info" size={14} />
                        <span className="text-xs font-bold">Note</span>
                    </div>
                    <p className="text-xs text-grey-1">
                        Activation steps read defensive hooks (useCapabilities / useIdentityVerification) that return
                        empty defaults when logged out, so every step renders here regardless of real KYC state.
                    </p>
                </Card>
            </div>
        </div>
    )
}
