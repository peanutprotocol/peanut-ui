'use client'

// dev-only showcase of every UI surface in the "Peanut moves to the app stores" migration.
// route: /dev/migration (public in local dev, notFound on prod).
// composed from the app's REAL components — ActionModal, CarouselCTA (home carousel),
// AvatarWithBadge, Button, the "Continue with Peanut" pattern and the landing hero —
// so these read like the live app. copy avoids the word "native app" (users don't know it).

import { useEffect, useState } from 'react'
import Image from 'next/image'
import ActionModal from '@/components/Global/ActionModal'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { PEANUTMAN, PEANUTMAN_MOBILE, PeanutWhistling } from '@/assets/mascot'
import { PEANUT_LOGO_BLACK } from '@/assets/logos'
import starImage from '@/assets/icons/star.png'

type Platform = 'ios' | 'android'
const STORE = { ios: 'App Store', android: 'Google Play' } as const

// device-aware store CTAs: the user's platform is the primary (purple), the other
// is secondary (stroke). brand logos (Apple / Play) aren't in the icon set yet — TODO.
function storeCtas(platform: Platform) {
    const other: Platform = platform === 'ios' ? 'android' : 'ios'
    return [
        { text: STORE[platform], variant: 'purple' as const, shadowSize: '4' as const, icon: 'mobile-install' as const },
        { text: STORE[other], variant: 'stroke' as const, shadowSize: '4' as const },
    ]
}
function StoreButtons({ platform }: { platform: Platform }) {
    const other: Platform = platform === 'ios' ? 'android' : 'ios'
    return (
        <div className="flex w-full flex-col gap-2">
            <Button variant="purple" shadowSize="4" icon="mobile-install" className="w-full">
                {STORE[platform]}
            </Button>
            <Button variant="stroke" shadowSize="4" className="w-full">
                {STORE[other]}
            </Button>
        </div>
    )
}

// mascot-holding-phone hero over white content. used for the access-ending screen + landing.
const STARS = ['left-[8%] top-[16%] size-8', 'right-[12%] top-[12%] size-9', 'right-[16%] bottom-[18%] size-7'] as const
function InstallScreen({ heading, sub, footer }: { heading: string; sub: string; footer?: React.ReactNode }) {
    return (
        <div className="relative mx-auto flex h-[660px] w-full max-w-[380px] flex-col overflow-hidden rounded-sm border border-n-1 bg-white">
            <section className="relative flex h-2/5 w-full items-center justify-center overflow-hidden bg-secondary-3">
                {STARS.map((pos, i) => (
                    <Image key={i} src={starImage.src} alt="" width={38} height={38} className={`absolute z-10 ${pos}`} />
                ))}
                <Image src={PEANUTMAN_MOBILE} alt="Peanut" width={150} height={150} className="z-0 object-contain" />
            </section>
            <section className="flex flex-1 flex-col gap-3 bg-white p-6">
                <h1 className="text-3xl font-bold text-n-1">{heading}</h1>
                <p className="text-base text-grey-1">{sub}</p>
                <div className="mt-auto flex flex-col gap-4">{footer}</div>
            </section>
        </div>
    )
}

// the live "Continue with Peanut" button (mascot + wordmark) from SendLinkActionList.
function ContinueWithPeanut() {
    return (
        <Button shadowSize="4" className="flex w-full items-center justify-center gap-1">
            <span>Continue with</span>
            <Image src={PEANUTMAN} alt="" className="size-5" />
            <Image src={PEANUT_LOGO_BLACK} alt="Peanut" className="h-4 w-auto" />
        </Button>
    )
}

function Section({ n, title, subtitle, children }: { n: string; title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-4 border-b border-n-1/15 py-10">
            <div>
                <div className="font-mono text-xs uppercase tracking-widest text-grey-1">{n}</div>
                <h2 className="text-h4 font-bold text-n-1">{title}</h2>
                <p className="max-w-2xl text-sm text-grey-1">{subtitle}</p>
            </div>
            {children}
        </section>
    )
}

const INDEX = [
    ['01 Download prompt', 'A modal asking logged-in web users to get the app. Countdown variant warns the site is closing.', 'Web app, after login, during the migration window.'],
    ['02 Access-ending screen', 'Full screen shown once the website is switched off — download is the only way forward.', 'Web app, after the cutover date, on every route.'],
    ['03 Guest link pages', 'The claim / request / invite pages a non-user lands on. Primary action is "Continue with Peanut" (opens the app / store).', 'Public links: /claim, /request, /invite, /pay, /profile.'],
    ['04 Get-the-app banner', 'A home-carousel card nudging users to install, without blocking anything.', 'Home screen carousel (web).'],
    ['05 Landing page', 'The marketing homepage hero — CTA is "Download", not "Sign up".', 'peanut.me for new / anonymous visitors.'],
    ['06 Review prompt', 'Asks happy users to rate the app; unhappy ones go to support instead.', 'In the app, after a good moment (money received, payment done).'],
    ['07 Notifications prompt', 'Custom ask before the OS permission popup, so we can ask again later.', 'In the app, at launch for users who never enabled push.'],
]

export default function MigrationMockupsPage() {
    const [platform, setPlatform] = useState<Platform>('ios')
    const [downloadModal, setDownloadModal] = useState(false)
    const [countdown, setCountdown] = useState(false)
    const [reviewModal, setReviewModal] = useState(false)
    const [pushModal, setPushModal] = useState(false)
    const [bannerOpen, setBannerOpen] = useState(true)

    // device-aware: default the primary store CTA to the visitor's platform.
    useEffect(() => {
        if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)) setPlatform('android')
    }, [])

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-h2 font-bold text-n-1">App migration — UI</h1>
                    <p className="mt-1 text-sm text-grey-1">
                        Every screen for moving Peanut to the App Store &amp; Google Play. Built from the real app
                        components.
                    </p>
                </div>
                {/* platform toggle — drives which store CTA is primary */}
                <div className="flex overflow-hidden rounded-sm border border-n-1">
                    {(['ios', 'android'] as Platform[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPlatform(p)}
                            className={`px-4 py-2 text-sm font-semibold ${platform === p ? 'bg-primary-1 text-n-1' : 'bg-white text-grey-1'}`}
                        >
                            {p === 'ios' ? 'iOS' : 'Android'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Component index */}
            <div className="mt-8 overflow-hidden rounded-sm border border-n-1">
                <div className="grid grid-cols-[minmax(0,1fr)] divide-y divide-n-1/15">
                    {INDEX.map(([name, what, where]) => (
                        <div key={name} className="grid gap-1 p-4 sm:grid-cols-[180px_1fr_1fr] sm:gap-4">
                            <div className="text-sm font-bold text-n-1">{name}</div>
                            <div className="text-sm text-grey-1">{what}</div>
                            <div className="text-sm text-grey-1">
                                <span className="font-mono text-xs uppercase text-n-1">where · </span>
                                {where}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 01 Download prompt */}
            <Section
                n="01"
                title="Download prompt (logged-in web users)"
                subtitle="Shown after login on the website. Dismissible. The countdown variant makes the deadline loud."
            >
                <div className="flex flex-wrap gap-3">
                    <Button variant="stroke" onClick={() => { setCountdown(false); setDownloadModal(true) }}>
                        Open (reminder)
                    </Button>
                    <Button variant="stroke" onClick={() => { setCountdown(true); setDownloadModal(true) }}>
                        Open (with countdown)
                    </Button>
                </div>
                <ActionModal
                    visible={downloadModal}
                    onClose={() => setDownloadModal(false)}
                    icon="mobile-install"
                    title="Peanut is moving to your phone"
                    description="Get the Peanut app from the App Store or Google Play to keep using your account — it's faster and you'll get alerts when money lands."
                    ctas={storeCtas(platform)}
                    footer={
                        countdown ? (
                            <div className="mt-4 flex flex-col items-center gap-1 rounded-sm border border-n-1 bg-primary-1 px-4 py-3">
                                <span className="text-3xl font-extrabold leading-none text-n-1">14 days</span>
                                <span className="text-xs font-semibold uppercase tracking-wide text-n-1">
                                    until the website closes
                                </span>
                            </div>
                        ) : (
                            <button className="mt-3 w-full text-center text-xs text-grey-1 underline" onClick={() => setDownloadModal(false)}>
                                Remind me later
                            </button>
                        )
                    }
                />
            </Section>

            {/* 02 Access-ending screen */}
            <Section
                n="02"
                title="Access-ending screen (after cutover)"
                subtitle="Full-screen once the website is switched off. Download is the way forward; support link covers people who can't install."
            >
                <InstallScreen
                    heading="Peanut lives on your phone now"
                    sub="The website has closed. Download the app to get back into your account — your money is safe."
                    footer={
                        <>
                            <StoreButtons platform={platform} />
                            <a className="text-center text-sm text-black underline" href="#">
                                Can&apos;t download the app? Contact support
                            </a>
                        </>
                    }
                />
            </Section>

            {/* 03 Guest link pages */}
            <Section
                n="03"
                title="Guest link pages (claim / request / invite)"
                subtitle="Whole page a non-user lands on. Same hero as today, primary action is 'Continue with Peanut' (opens the app, or the store if not installed). Mock data."
            >
                <div className="grid gap-6 lg:grid-cols-3">
                    <GuestPage kind="claim" name="alice" amount="$25.00" />
                    <GuestPage kind="request" name="bob" amount="$40.00" />
                    <GuestPage kind="invite" name="carol" amount="" />
                </div>
            </Section>

            {/* 04 Get-the-app banner */}
            <Section
                n="04"
                title="Get-the-app banner (home carousel)"
                subtitle="A home-screen carousel card — same component as the other home CTAs. Nudges without blocking."
            >
                {bannerOpen ? (
                    <div className="max-w-md">
                        <CarouselCTA
                            icon="mobile-install"
                            logo={PEANUTMAN_MOBILE}
                            title="Get the Peanut app"
                            description="Faster payments and alerts when money lands"
                            onClose={() => setBannerOpen(false)}
                            onClick={() => {}}
                        />
                    </div>
                ) : (
                    <Button variant="stroke" onClick={() => setBannerOpen(true)}>Reset banner</Button>
                )}
            </Section>

            {/* 05 Landing page — responsive full-width hero (mirrors the real landing) */}
            <Section
                n="05"
                title="Landing page hero (new visitors)"
                subtitle="The real landing hero, reworked: brand-pink + drifting clouds + mascot, responsive (full-width on web, stacked on phone). CTA is 'Download' with store buttons + a rating — no 'Sign up'."
            >
                <div className="relative w-full overflow-hidden rounded-sm border border-n-1 bg-primary-1 px-4 py-14 md:py-20">
                    <CloudsCss />
                    <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
                        <Image
                            src={PeanutWhistling.src}
                            alt="Peanut"
                            width={220}
                            height={220}
                            className="w-28 object-contain md:w-44"
                        />
                        <h1 className="font-roboto-flex-extrabold text-[2rem] font-extraBlack leading-none text-n-1 md:text-6xl">
                            TAP. SCAN. ANYWHERE.
                        </h1>
                        <p className="max-w-md text-base text-n-1/80 md:text-xl">
                            Send money like a text — no bank, no borders. Download the app and send in seconds.
                        </p>
                        <div className="mt-2 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
                            <Button variant="dark" shadowSize="4" icon="mobile-install" className="sm:w-52">
                                {STORE[platform]}
                            </Button>
                            <Button variant="stroke" shadowSize="4" className="bg-white sm:w-52">
                                {STORE[platform === 'ios' ? 'android' : 'ios']}
                            </Button>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-n-1">
                            <Icon name="star" size={16} /> 4.8 · loved by thousands
                        </div>
                    </div>
                </div>
            </Section>

            {/* 06 Review prompt */}
            <Section
                n="06"
                title="Review prompt (in-app, after a good moment)"
                subtitle="Custom pre-prompt. 'Love it' opens the store rating sheet; 'Could be better' opens support instead — so bad reviews never reach the store."
            >
                <Button variant="stroke" onClick={() => setReviewModal(true)}>Open review prompt</Button>
                <ActionModal
                    visible={reviewModal}
                    onClose={() => setReviewModal(false)}
                    icon="star"
                    title="Loving Peanut so far?"
                    description="A quick rating helps other people find us."
                    ctas={[
                        { text: 'Love it', variant: 'purple', shadowSize: '4', onClick: () => setReviewModal(false) },
                        { text: 'Could be better', variant: 'stroke', shadowSize: '4', onClick: () => setReviewModal(false) },
                    ]}
                />
            </Section>

            {/* 07 Notifications prompt */}
            <Section
                n="07"
                title="Notifications prompt (in-app launch)"
                subtitle="Our own ask before the OS popup — if they say not now, we can ask again later (the OS popup only fires on 'Allow')."
            >
                <Button variant="stroke" onClick={() => setPushModal(true)}>Open notifications prompt</Button>
                <ActionModal
                    visible={pushModal}
                    onClose={() => setPushModal(false)}
                    icon="bell"
                    title="Get money alerts"
                    description="We'll ping you the moment money lands or someone asks you to pay."
                    ctas={[
                        { text: 'Allow', variant: 'purple', shadowSize: '4', onClick: () => setPushModal(false) },
                        { text: 'Not now', variant: 'stroke', shadowSize: '4', onClick: () => setPushModal(false) },
                    ]}
                />
            </Section>
        </div>
    )
}

function GuestPage({ kind, name, amount }: { kind: 'claim' | 'request' | 'invite'; name: string; amount: string }) {
    const hero =
        kind === 'claim'
            ? { label: `${name} sent you`, big: amount }
            : kind === 'request'
              ? { label: `${name} is requesting`, big: amount }
              : { label: `${name} invited you to`, big: '' }
    return (
        <div className="mx-auto flex h-[560px] w-full max-w-[340px] flex-col overflow-hidden rounded-sm border border-n-1 bg-white">
            {/* header */}
            <div className="flex items-center justify-center border-b border-n-1/10 py-3">
                <Image src={PEANUT_LOGO_BLACK} alt="Peanut" className="h-4 w-auto" />
            </div>
            {/* hero */}
            <div className="flex flex-col items-center gap-3 px-6 pb-4 pt-8">
                <AvatarWithBadge name={name} size="large" />
                <div className="text-center">
                    <div className="text-sm text-grey-1">{hero.label}</div>
                    {hero.big ? (
                        <div className="text-4xl font-extrabold text-n-1">{hero.big}</div>
                    ) : (
                        <div className="mt-1 flex items-center justify-center gap-1 text-2xl font-extrabold text-n-1">
                            <Image src={PEANUT_LOGO_BLACK} alt="Peanut" className="h-5 w-auto" />
                        </div>
                    )}
                </div>
            </div>
            {/* actions */}
            <div className="mt-auto flex flex-col gap-3 p-5">
                <ContinueWithPeanut />
                {kind !== 'invite' && (
                    <>
                        <div className="flex items-center gap-3 text-xs text-grey-1">
                            <span className="h-px flex-1 bg-n-1/15" /> or <span className="h-px flex-1 bg-n-1/15" />
                        </div>
                        <div className="flex flex-col gap-2">
                            {['Claim to bank account', 'Claim to Pix'].map((m) => (
                                <div key={m} className="flex items-center gap-3 rounded-sm border border-n-1 px-4 py-3">
                                    <Icon name="bank" size={18} />
                                    <span className="text-sm font-medium text-n-1">{m}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                <p className="text-center text-xs text-grey-1">Opens the Peanut app — or the store if you don&apos;t have it yet.</p>
            </div>
        </div>
    )
}
