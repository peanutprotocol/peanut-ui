'use client'

// dev-only showcase of every UI surface in the PWA -> native app migration.
// route: /dev/migration (public in local dev, notFound on prod).
// composed from the app's REAL components — ActionModal, AvatarWithBadge, Button,
// QRCodeWrapper — and mirrors the ForceIOSPWAInstall two-section install screen,
// so these read like the live app, not bespoke markup.

import { useState } from 'react'
import Image from 'next/image'
import ActionModal from '@/components/Global/ActionModal'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { PEANUTMAN_PFP } from '@/assets'
import starImage from '@/assets/icons/star.png'

// platform-aware in prod (App Store on iOS, Play on Android). shown stacked here.
function StoreButtons() {
    return (
        <div className="flex w-full flex-col gap-2">
            <Button variant="purple" shadowSize="4" icon="mobile-install" className="w-full">
                Download on the App Store
            </Button>
            <Button variant="stroke" shadowSize="4" className="w-full">
                Get it on Google Play
            </Button>
        </div>
    )
}

// mirrors ForceIOSPWAInstall: secondary-3 hero (peanut + stars) over a white
// content half. used for the full-screen block and the app-store-only landing.
const STARS = ['left-[8%] top-[14%] size-8', 'right-[12%] top-[10%] size-9', 'right-[14%] bottom-[16%] size-8'] as const
function InstallScreen({
    heading,
    sub,
    footer,
}: {
    heading: string
    sub: string
    footer?: React.ReactNode
}) {
    return (
        <div className="relative mx-auto flex h-[660px] w-full max-w-[380px] flex-col overflow-hidden rounded-sm border border-n-1 bg-white">
            <section className="relative flex h-2/5 w-full items-center justify-center overflow-hidden bg-secondary-3">
                {STARS.map((pos, i) => (
                    <Image key={i} src={starImage.src} alt="" width={40} height={40} className={`absolute z-10 ${pos}`} />
                ))}
                <Image src={PEANUTMAN_PFP} alt="Peanut" width={132} height={132} className="z-0 object-contain" />
            </section>
            <section className="flex flex-1 flex-col gap-3 bg-white p-6">
                <h1 className="text-3xl font-bold text-n-1">{heading}</h1>
                <p className="text-base text-grey-1">{sub}</p>
                <div className="mt-auto flex flex-col gap-4">{footer}</div>
            </section>
        </div>
    )
}

function Section({
    n,
    title,
    subtitle,
    children,
}: {
    n: string
    title: string
    subtitle: string
    children: React.ReactNode
}) {
    return (
        <section className="flex flex-col gap-4 border-b border-n-1/15 py-10">
            <div>
                <div className="font-mono text-xs uppercase tracking-widest text-grey-1">{n}</div>
                <h2 className="text-h4 font-bold text-n-1">{title}</h2>
                <p className="max-w-xl text-sm text-grey-1">{subtitle}</p>
            </div>
            {children}
        </section>
    )
}

export default function MigrationMockupsPage() {
    const [downloadModal, setDownloadModal] = useState(false)
    const [downloadCountdown, setDownloadCountdown] = useState(false)
    const [reviewModal, setReviewModal] = useState(false)
    const [pushModal, setPushModal] = useState(false)
    const [bannerOpen, setBannerOpen] = useState(true)

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
            <h1 className="text-h2 font-bold text-n-1">Native App Migration — UI</h1>
            <p className="mt-1 text-sm text-grey-1">
                Every component in the PWA to native migration, built from the app&apos;s real components. Dev-only
                preview.
            </p>

            {/* 1. Existing-user download modal — ActionModal */}
            <Section
                n="01"
                title="Download modal (existing user, web)"
                subtitle="Fired post-login on web. Dismissible. Countdown variant adds the sunset deadline."
            >
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="stroke"
                        onClick={() => {
                            setDownloadCountdown(false)
                            setDownloadModal(true)
                        }}
                    >
                        Open (notice)
                    </Button>
                    <Button
                        variant="stroke"
                        onClick={() => {
                            setDownloadCountdown(true)
                            setDownloadModal(true)
                        }}
                    >
                        Open (with countdown)
                    </Button>
                </div>
                <ActionModal
                    visible={downloadModal}
                    onClose={() => setDownloadModal(false)}
                    icon="mobile-install"
                    title="Peanut is now a native app"
                    description="We've moved to a native app for a faster, smoother experience. Download it to keep using Peanut."
                    ctas={[
                        { text: 'Download on the App Store', variant: 'purple', shadowSize: '4', icon: 'mobile-install' },
                        { text: 'Get it on Google Play', variant: 'stroke', shadowSize: '4' },
                    ]}
                    footer={
                        downloadCountdown ? (
                            <p className="mt-3 text-center text-sm font-semibold text-n-1">
                                14 days until web access ends
                            </p>
                        ) : (
                            <button
                                className="mt-3 w-full text-center text-xs text-grey-1 underline"
                                onClick={() => setDownloadModal(false)}
                            >
                                Remind me later
                            </button>
                        )
                    }
                />
            </Section>

            {/* 2. 30-day hard block — install screen */}
            <Section
                n="02"
                title="30-day hard block (post-deadline, web)"
                subtitle="Full-screen, non-dismissible. Store CTA + support escape hatch for users who can't install."
            >
                <InstallScreen
                    heading="Web access has ended"
                    sub="Peanut is now a native app. Download it to continue."
                    footer={
                        <>
                            <StoreButtons />
                            <a className="text-center text-sm text-black underline" href="#">
                                Can&apos;t install? Contact support
                            </a>
                        </>
                    }
                />
            </Section>

            {/* 3. Guest download CTA — AvatarWithBadge + real amount hero */}
            <Section
                n="03"
                title="Guest download CTA (public routes)"
                subtitle="Non-user opens a claim / pay / invite link in a browser. Mirrors the live pay/claim hero (avatar + amount), then gates the action behind download."
            >
                <div className="grid gap-4 sm:grid-cols-3">
                    <GuestCta name="alice" label="is sending you" amount="$25.00" verb="Claim" icon="gift" />
                    <GuestCta name="bob" label="requested" amount="$40.00" verb="Pay" icon="arrow-up-right" />
                    <GuestCta name="carol" label="invited you to Peanut" amount="" verb="Join" icon="invite-heart" />
                </div>
            </Section>

            {/* 4. Open-in-app banner */}
            <Section
                n="04"
                title="Open-in-app banner (installed users, web)"
                subtitle="Slim, dismissible. Bounces returning users into the native app. iOS Smart App Banner style."
            >
                {bannerOpen ? (
                    <div className="flex items-center gap-3 rounded-sm border border-n-1 bg-white px-3 py-2">
                        <button className="px-1 text-grey-1" onClick={() => setBannerOpen(false)} aria-label="dismiss">
                            <Icon name="cancel" size={14} />
                        </button>
                        <AvatarWithBadge logo={PEANUTMAN_PFP} size="small" />
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-n-1">Peanut</div>
                            <div className="text-xs text-grey-1">Faster in the app</div>
                        </div>
                        <Button variant="purple" shadowSize="4" size="large">
                            Open
                        </Button>
                    </div>
                ) : (
                    <Button variant="stroke" onClick={() => setBannerOpen(true)}>
                        Reset banner
                    </Button>
                )}
            </Section>

            {/* 5. Landing app-store-only — install screen + QR */}
            <Section
                n="05"
                title="Landing hero — app-store-only (new users)"
                subtitle="No web signup. Store badges on mobile, QR for desktop."
            >
                <InstallScreen
                    heading="Money, simplified"
                    sub="Download the Peanut app to get started."
                    footer={
                        <>
                            <StoreButtons />
                            <div className="flex flex-col items-center gap-2">
                                <span className="font-mono text-xs uppercase tracking-widest text-grey-1">
                                    or scan on desktop
                                </span>
                                <QRCodeWrapper url="https://peanut.me/app" className="max-w-[104px]" />
                            </div>
                        </>
                    }
                />
            </Section>

            {/* 6. Setup prefill state */}
            <Section
                n="06"
                title="Setup prefill (post-install, deferred deep link)"
                subtitle="After the deferred deep link resolves, setup confirms the recovered context so it doesn't look like a blank form."
            >
                <div className="mx-auto flex w-full max-w-[380px] flex-col items-center gap-5 rounded-sm border border-n-1 bg-white p-6">
                    <AvatarWithBadge name="carol" size="large" />
                    <div className="text-center">
                        <div className="text-2xl font-bold text-n-1">carol invited you</div>
                        <p className="text-sm text-grey-1">Create your wallet and you&apos;ll land right on the invite.</p>
                    </div>
                    <Button variant="purple" shadowSize="4" className="w-full">
                        Create your Peanut wallet
                    </Button>
                </div>
            </Section>

            {/* 7. Review nudge — ActionModal */}
            <Section
                n="07"
                title="App Store review nudge (native)"
                subtitle="Custom pre-prompt before the OS review sheet, to protect quota and route unhappy users to feedback."
            >
                <Button variant="stroke" onClick={() => setReviewModal(true)}>
                    Open review pre-prompt
                </Button>
                <ActionModal
                    visible={reviewModal}
                    onClose={() => setReviewModal(false)}
                    icon="star"
                    title="Enjoying Peanut?"
                    description="Your feedback helps us improve. How's it going so far?"
                    ctas={[
                        { text: 'Love it', variant: 'purple', shadowSize: '4', onClick: () => setReviewModal(false) },
                        { text: 'Not really', variant: 'stroke', onClick: () => setReviewModal(false) },
                    ]}
                    footer={
                        <p className="mt-2 text-center text-xs text-grey-1">
                            &quot;Love it&quot; opens the OS rating sheet · &quot;Not really&quot; routes to support
                        </p>
                    }
                />
            </Section>

            {/* 8. Push opt-in — ActionModal */}
            <Section
                n="08"
                title="Push opt-in modal (native launch)"
                subtitle="Custom modal fires first — the native OS prompt only fires after this confirm, so re-prompt ability is never lost."
            >
                <Button variant="stroke" onClick={() => setPushModal(true)}>
                    Open push opt-in
                </Button>
                <ActionModal
                    visible={pushModal}
                    onClose={() => setPushModal(false)}
                    icon="bell"
                    title="Turn on notifications"
                    description="Get notified when you receive money or a payment request comes in."
                    ctas={[
                        {
                            text: 'Enable notifications',
                            variant: 'purple',
                            shadowSize: '4',
                            onClick: () => setPushModal(false),
                        },
                        { text: 'Not now', variant: 'stroke', onClick: () => setPushModal(false) },
                    ]}
                />
            </Section>
        </div>
    )
}

function GuestCta({
    name,
    label,
    amount,
    verb,
    icon,
}: {
    name: string
    label: string
    amount: string
    verb: string
    icon: 'gift' | 'arrow-up-right' | 'invite-heart'
}) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-n-1 bg-white p-5 text-center">
            <AvatarWithBadge name={name} icon={icon} />
            <div>
                <div className="text-sm text-grey-1">
                    <span className="font-semibold text-n-1">{name}</span> {label}
                </div>
                {amount && <div className="text-h3 font-bold text-n-1">{amount}</div>}
            </div>
            <Button variant="purple" shadowSize="4" className="w-full">
                {verb} in the app
            </Button>
            <p className="text-xs text-grey-1">Saved — you&apos;ll land here after install.</p>
        </div>
    )
}
