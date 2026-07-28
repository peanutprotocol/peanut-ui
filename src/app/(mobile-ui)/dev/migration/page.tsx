'use client'

// dev-only showcase of every UI surface in the PWA -> native app migration.
// route: /dev/migration (public in local dev, notFound on prod).
// components are composed from real Bruddle primitives (Modal, Button, QRCodeWrapper)
// so this doubles as the integration reference — lift these into real components when wiring.

import { useState } from 'react'
import Modal from '@/components/Global/Modal'
import { Button } from '@/components/0_Bruddle/Button'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'

// shared store CTA — platform-aware in prod (App Store on iOS, Play on Android).
// here we show both stacked so every variant is visible at once.
function StoreButtons() {
    return (
        <div className="flex w-full flex-col gap-2">
            <Button variant="purple" shadowSize="4" icon="download" className="w-full">
                Download on the App Store
            </Button>
            <Button variant="stroke" shadowSize="4" className="w-full">
                Get it on Google Play
            </Button>
        </div>
    )
}

// simulates a mobile viewport so full-screen / inline surfaces preview at phone size.
function PhoneFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`relative mx-auto flex h-[640px] w-full max-w-[380px] flex-col overflow-hidden rounded-sm border border-n-1 bg-white ${className}`}
        >
            {children}
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
        <section className="flex flex-col gap-4 border-b border-n-1/20 py-10">
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
                Every component in the PWA to native migration, built from real Bruddle primitives. Dev-only preview.
            </p>

            {/* 1. Existing-user download modal */}
            <Section
                n="01"
                title="Download modal (existing user, web)"
                subtitle="Fired post-login on web. Dismissible. Second state adds the 30-day countdown."
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
                <Modal
                    visible={downloadModal}
                    onClose={() => setDownloadModal(false)}
                    title="Peanut is now a native app"
                >
                    <div className="flex flex-col items-center gap-4 p-6">
                        <p className="text-center text-sm text-grey-1">
                            We&apos;ve moved to a native app for a faster, smoother experience. Download it to keep using
                            Peanut.
                        </p>
                        {downloadCountdown && (
                            <div className="w-full rounded-sm border border-n-1 bg-primary-3 px-4 py-2 text-center text-sm font-semibold text-n-1">
                                14 days until web access ends
                            </div>
                        )}
                        <StoreButtons />
                        <button className="text-xs text-grey-1 underline" onClick={() => setDownloadModal(false)}>
                            Remind me later
                        </button>
                    </div>
                </Modal>
            </Section>

            {/* 2. 30-day hard block */}
            <Section
                n="02"
                title="30-day hard block (post-deadline, web)"
                subtitle="Full-screen, non-dismissible. Store CTA + support escape hatch for users who can't install."
            >
                <PhoneFrame className="items-center justify-center p-8">
                    <div className="flex flex-col items-center gap-5 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-sm border border-n-1 bg-primary-1 text-2xl">
                            🥜
                        </div>
                        <div>
                            <h3 className="text-h4 font-bold text-n-1">Peanut is now a native app</h3>
                            <p className="mt-1 text-sm text-grey-1">
                                Web access has ended. Download the app to continue using Peanut.
                            </p>
                        </div>
                        <StoreButtons />
                        <a className="text-sm text-black underline" href="#">
                            Can&apos;t install? Contact support
                        </a>
                    </div>
                </PhoneFrame>
            </Section>

            {/* 3. Guest download CTA — per flow */}
            <Section
                n="03"
                title="Guest download CTA (public routes)"
                subtitle="Non-user opens a claim / pay / invite link in a browser. Preview the pending action + gated download. One reusable card, context slot changes per flow."
            >
                <div className="grid gap-4 sm:grid-cols-3">
                    <GuestCta
                        badge="Claim"
                        title="You&apos;re claiming"
                        amount="$25.00"
                        sub="from alice.peanut"
                    />
                    <GuestCta badge="Pay request" title="Pay bob&apos;s request" amount="$40.00" sub="for dinner" />
                    <GuestCta badge="Invite" title="carol invited you" amount="" sub="to join Peanut" />
                </div>
            </Section>

            {/* 4. Open-in-app banner */}
            <Section
                n="04"
                title="Open-in-app banner (installed users, web)"
                subtitle="Slim, dismissible. Bounces returning users into the native app. iOS Smart App Banner style."
            >
                {bannerOpen ? (
                    <div className="flex items-center gap-3 rounded-sm border border-n-1 bg-white px-4 py-3">
                        <button className="text-grey-1" onClick={() => setBannerOpen(false)} aria-label="dismiss">
                            ✕
                        </button>
                        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-n-1 bg-primary-1">
                            🥜
                        </div>
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

            {/* 5. Landing page app-store-only */}
            <Section
                n="05"
                title="Landing hero — app-store-only (new users)"
                subtitle="No web signup. Store badges on mobile, QR for desktop."
            >
                <PhoneFrame className="items-center justify-center p-8">
                    <div className="flex flex-col items-center gap-5 text-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-sm border border-n-1 bg-primary-1 text-3xl">
                            🥜
                        </div>
                        <div>
                            <h3 className="text-h3 font-bold text-n-1">Money, simplified</h3>
                            <p className="mt-1 text-sm text-grey-1">Download the Peanut app to get started.</p>
                        </div>
                        <StoreButtons />
                        <div className="flex flex-col items-center gap-2 pt-2">
                            <span className="font-mono text-xs uppercase tracking-widest text-grey-1">
                                or scan on desktop
                            </span>
                            <QRCodeWrapper url="https://peanut.me/app" className="max-w-[120px]" />
                        </div>
                    </div>
                </PhoneFrame>
            </Section>

            {/* 6. Setup prefill state */}
            <Section
                n="06"
                title="Setup prefill (post-install, deferred deep link)"
                subtitle="After the deferred deep link resolves, setup confirms the recovered context so it doesn't look like a blank form."
            >
                <div className="mx-auto flex w-full max-w-[380px] flex-col gap-4 rounded-sm border border-n-1 bg-white p-6">
                    <div className="flex items-center gap-3 rounded-sm border border-n-1 bg-primary-3 px-4 py-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-n-1 bg-primary-1">
                            🥜
                        </div>
                        <div className="text-sm">
                            <div className="font-semibold text-n-1">Invited by carol</div>
                            <div className="text-grey-1">You&apos;ll land on your invite after sign up</div>
                        </div>
                    </div>
                    <Button variant="purple" shadowSize="4" className="w-full">
                        Create your Peanut wallet
                    </Button>
                </div>
            </Section>

            {/* 7. Review nudge */}
            <Section
                n="07"
                title="App Store review nudge (native)"
                subtitle="Custom pre-prompt before the OS review sheet, to protect quota and route unhappy users to feedback."
            >
                <Button variant="stroke" onClick={() => setReviewModal(true)}>
                    Open review pre-prompt
                </Button>
                <Modal visible={reviewModal} onClose={() => setReviewModal(false)} title="Enjoying Peanut?">
                    <div className="flex flex-col gap-3 p-6">
                        <p className="text-center text-sm text-grey-1">
                            Your feedback helps us improve. How&apos;s it going?
                        </p>
                        <Button variant="purple" shadowSize="4" className="w-full" onClick={() => setReviewModal(false)}>
                            Love it
                        </Button>
                        <Button variant="stroke" className="w-full" onClick={() => setReviewModal(false)}>
                            Not really
                        </Button>
                        <p className="text-center text-xs text-grey-1">
                            &quot;Love it&quot; opens the OS rating sheet. &quot;Not really&quot; routes to support.
                        </p>
                    </div>
                </Modal>
            </Section>

            {/* 8. Push opt-in modal */}
            <Section
                n="08"
                title="Push opt-in modal (native launch)"
                subtitle="Custom modal fires first — the native OS prompt only fires after this confirm, so re-prompt ability is never lost."
            >
                <Button variant="stroke" onClick={() => setPushModal(true)}>
                    Open push opt-in
                </Button>
                <Modal visible={pushModal} onClose={() => setPushModal(false)} title="Turn on notifications">
                    <div className="flex flex-col gap-3 p-6">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm border border-n-1 bg-primary-1 text-2xl">
                            🔔
                        </div>
                        <p className="text-center text-sm text-grey-1">
                            Get notified when you receive money or a payment request comes in.
                        </p>
                        <Button variant="purple" shadowSize="4" className="w-full" onClick={() => setPushModal(false)}>
                            Enable notifications
                        </Button>
                        <button className="text-center text-xs text-grey-1 underline" onClick={() => setPushModal(false)}>
                            Not now
                        </button>
                    </div>
                </Modal>
            </Section>
        </div>
    )
}

function GuestCta({ badge, title, amount, sub }: { badge: string; title: string; amount: string; sub: string }) {
    return (
        <div className="flex flex-col gap-3 rounded-sm border border-n-1 bg-white p-4">
            <span className="w-fit rounded-sm border border-n-1 bg-primary-3 px-2 py-0.5 font-mono text-xs uppercase text-n-1">
                {badge}
            </span>
            <div>
                <div className="text-sm text-grey-1" dangerouslySetInnerHTML={{ __html: title }} />
                {amount && <div className="text-h3 font-bold text-n-1">{amount}</div>}
                <div className="text-sm text-grey-1">{sub}</div>
            </div>
            <Button variant="purple" shadowSize="4" size="large" className="w-full">
                Download Peanut
            </Button>
            <p className="text-xs text-grey-1">Saved — you&apos;ll land here after install.</p>
        </div>
    )
}
