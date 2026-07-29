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
import { Hero } from '@/components/LandingPage/hero'
import PeanutActionDetailsCard, {
    type PeanutActionDetailsCardTransactionType,
} from '@/components/Global/PeanutActionDetailsCard'
import { ActionListCard } from '@/components/ActionListCard'
import Divider from '@/components/0_Bruddle/Divider'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'
import { PEANUTMAN, PEANUTMAN_MOBILE } from '@/assets/mascot'
import { PEANUT_LOGO_BLACK } from '@/assets/logos'
import starImage from '@/assets/icons/star.png'

type Platform = 'ios' | 'android' | 'desktop'
const STORE = { ios: 'App Store', android: 'Google Play' } as const

const STORE_URL = {
    ios: 'https://apps.apple.com/app/peanut',
    android: 'https://play.google.com/store/apps/details?id=me.peanut.wallet',
} as const

// scan-to-download with a store toggle. on the web we can't know the visitor's phone OS,
// so we show both store QRs behind a toggle instead of guessing which to display.
// (A single smart link — peanut.me/app redirecting by device — would remove the toggle.)
function DownloadQR() {
    const [store, setStore] = useState<'ios' | 'android'>('ios')
    return (
        <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex overflow-hidden rounded-sm border border-n-1">
                {(['ios', 'android'] as const).map((s) => (
                    <button
                        key={s}
                        onClick={() => setStore(s)}
                        className={`px-4 py-1.5 text-sm font-semibold ${store === s ? 'bg-primary-1 text-n-1' : 'bg-white text-grey-1'}`}
                    >
                        {STORE[s]}
                    </button>
                ))}
            </div>
            <QRCodeWrapper url={STORE_URL[store]} />
            <span className="text-xs text-grey-1">Scan with your phone camera</span>
        </div>
    )
}

// one primary CTA per device: the visitor's store on mobile, the scan-to-download QR on desktop.
function StoreButtons({ platform }: { platform: Platform }) {
    if (platform === 'desktop') return <DownloadQR />
    return (
        <Button variant="purple" shadowSize="4" icon="mobile-install" className="w-full">
            {STORE[platform]}
        </Button>
    )
}

// mascot hero over white content. used for the access-ending screen.
// height is content-driven (no fixed h) so the desktop QR never overflows, and the
// mascot is size-capped with margin inside the hero so its feet never clip.
const STARS = ['left-[8%] top-[18%] size-8', 'right-[12%] top-[14%] size-9', 'right-[14%] bottom-[16%] size-7'] as const
function InstallScreen({ heading, sub, footer }: { heading: string; sub: string; footer?: React.ReactNode }) {
    return (
        <div className="mx-auto flex w-full max-w-[380px] flex-col overflow-hidden rounded-sm border border-n-1 bg-white">
            <section className="relative flex h-64 w-full items-center justify-center overflow-hidden bg-secondary-3 px-6">
                {STARS.map((pos, i) => (
                    <Image
                        key={i}
                        src={starImage.src}
                        alt=""
                        width={38}
                        height={38}
                        className={`absolute z-10 ${pos}`}
                    />
                ))}
                <Image
                    src={PEANUTMAN_MOBILE}
                    alt="Peanut"
                    width={200}
                    height={200}
                    className="z-0 h-40 w-auto object-contain"
                />
            </section>
            <section className="flex flex-col gap-3 bg-white p-6">
                <h1 className="text-3xl font-bold text-n-1">{heading}</h1>
                <p className="text-base text-grey-1">{sub}</p>
                <div className="mt-4 flex flex-col gap-4">{footer}</div>
            </section>
        </div>
    )
}

// the live "Continue with Peanut" button (mascot + wordmark) from SendLinkActionList.
function ContinueWithPeanut({ onClick }: { onClick?: () => void }) {
    return (
        <Button shadowSize="4" onClick={onClick} className="flex w-full items-center justify-center gap-1">
            <span>Continue with</span>
            <Image src={PEANUTMAN} alt="" className="size-5" />
            <Image src={PEANUT_LOGO_BLACK} alt="Peanut" className="h-4 w-auto" />
        </Button>
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
                <p className="max-w-2xl text-sm text-grey-1">{subtitle}</p>
            </div>
            {children}
        </section>
    )
}

const INDEX = [
    [
        '01 Download prompt',
        'A modal telling logged-in web users Peanut is becoming app-only, with the deadline in the copy. QR shown inline on desktop.',
        'Web app, after login, during the migration window.',
    ],
    [
        '02 Access-ending screen',
        'Full screen shown once the website is switched off — download is the only way forward.',
        'Web app, after the cutover date, on every route.',
    ],
    [
        '03 Guest link pages',
        'The claim / request / invite pages a non-user lands on. Primary action is "Continue with Peanut" (opens the app / store).',
        'Public links: /claim, /request, /invite, /pay, /profile.',
    ],
    [
        '04 Get-the-app banner',
        'A home-carousel card nudging users to install, without blocking anything.',
        'Home screen carousel (web).',
    ],
    [
        '05 Landing page',
        'The marketing homepage hero — CTA is "Download", not "Sign up".',
        'peanut.me for new / anonymous visitors.',
    ],
    [
        '06 Review prompt',
        'Asks happy users to rate the app; unhappy ones go to support instead.',
        'In the app, after a good moment (money received, payment done).',
    ],
    [
        '07 Notifications prompt',
        'Custom ask before the OS permission popup, so we can ask again later.',
        'In the app, at launch for users who never enabled push.',
    ],
    [
        '08 Scan-to-download (QR)',
        "On desktop we can't tell iOS from Android, so the QR carries a store toggle — one QR at a time. Shown inline (01) or as a modal (03, 05) wherever a download CTA appears on web.",
        'Every download CTA when the visitor is on a desktop browser.',
    ],
]

export default function MigrationMockupsPage() {
    const [platform, setPlatform] = useState<Platform>('ios')
    const [downloadModal, setDownloadModal] = useState(false)
    const [reviewModal, setReviewModal] = useState(false)
    const [pushModal, setPushModal] = useState(false)
    const [qrModal, setQrModal] = useState(false)
    const [bannerOpen, setBannerOpen] = useState(true)

    // desktop download CTAs open the QR modal instead of dead store links.
    const openQr = () => {
        setDownloadModal(false)
        setQrModal(true)
    }

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
                {/* platform toggle — drives the download CTA (store buttons vs desktop QR) */}
                <div className="flex overflow-hidden rounded-sm border border-n-1">
                    {(['ios', 'android', 'desktop'] as Platform[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPlatform(p)}
                            className={`px-4 py-2 text-sm font-semibold ${platform === p ? 'bg-primary-1 text-n-1' : 'bg-white text-grey-1'}`}
                        >
                            {p === 'ios' ? 'iOS' : p === 'android' ? 'Android' : 'Desktop'}
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
                subtitle="Shown after login on the website. One variant, deadline baked into the copy. On mobile: your store's button. On desktop: the QR is shown inline (no extra click)."
            >
                <Button variant="stroke" onClick={() => setDownloadModal(true)}>
                    Open download prompt
                </Button>
                <ActionModal
                    visible={downloadModal}
                    onClose={() => setDownloadModal(false)}
                    icon="mobile-install"
                    title="Peanut is becoming an app"
                    description={
                        <p className="py-1">
                            Peanut is moving to the App Store and Google Play. In <b className="text-black">14 days</b>{' '}
                            it will only work in the app — download it now to keep using your account.
                        </p>
                    }
                    content={platform === 'desktop' ? <DownloadQR /> : undefined}
                    ctas={
                        platform === 'desktop'
                            ? []
                            : [
                                  {
                                      text: STORE[platform],
                                      variant: 'purple' as const,
                                      shadowSize: '4' as const,
                                      icon: 'mobile-install' as const,
                                  },
                              ]
                    }
                    footer={
                        <button
                            className="mt-3 w-full text-center text-xs text-grey-1 underline"
                            onClick={() => setDownloadModal(false)}
                        >
                            Remind me later
                        </button>
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
                    <GuestPage kind="claim" onCta={platform === 'desktop' ? openQr : () => {}} />
                    <GuestPage kind="request" onCta={platform === 'desktop' ? openQr : () => {}} />
                    <GuestPage kind="invite" onCta={platform === 'desktop' ? openQr : () => {}} />
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
                    <Button variant="stroke" onClick={() => setBannerOpen(true)}>
                        Reset banner
                    </Button>
                )}
            </Section>

            {/* 05 Landing page — the real <Hero> component, only the CTA is device-based */}
            <Section
                n="05"
                title="Landing page hero (new visitors)"
                subtitle="The real landing hero (same component as peanut.me). CTA says 'Download now' for everyone; on mobile it deep-links to the visitor's store, on desktop it opens the scan-to-download QR."
            >
                <div
                    className="overflow-hidden rounded-sm border border-n-1"
                    onClickCapture={
                        platform === 'desktop'
                            ? (e) => {
                                  e.preventDefault()
                                  setQrModal(true)
                              }
                            : undefined
                    }
                >
                    <Hero
                        buttonVisible
                        primaryCta={{
                            label: 'Download now',
                            href: platform === 'ios' ? STORE_URL.ios : platform === 'android' ? STORE_URL.android : '#',
                        }}
                    />
                </div>
            </Section>

            {/* 06 Review prompt */}
            <Section
                n="06"
                title="Review prompt (in-app, after a good moment)"
                subtitle="Custom pre-prompt. 'Love it' opens the store rating sheet; 'Could be better' opens support instead — so bad reviews never reach the store."
            >
                <Button variant="stroke" onClick={() => setReviewModal(true)}>
                    Open review prompt
                </Button>
                <ActionModal
                    visible={reviewModal}
                    onClose={() => setReviewModal(false)}
                    icon="star"
                    title="Loving Peanut so far?"
                    description="A quick rating helps other people find us."
                    ctas={[
                        { text: 'Love it', variant: 'purple', shadowSize: '4', onClick: () => setReviewModal(false) },
                        { text: 'Meh', variant: 'stroke', shadowSize: '4', onClick: () => setReviewModal(false) },
                    ]}
                />
            </Section>

            {/* 07 Notifications prompt */}
            <Section
                n="07"
                title="Notifications prompt (in-app launch)"
                subtitle="Our own ask before the OS popup — if they say not now, we can ask again later (the OS popup only fires on 'Allow')."
            >
                <Button variant="stroke" onClick={() => setPushModal(true)}>
                    Open notifications prompt
                </Button>
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

            {/* 08 Scan-to-download (QR) — the desktop download surface */}
            <Section
                n="08"
                title="Scan-to-download modal (desktop)"
                subtitle="Web users can't install from a laptop, so a download CTA on desktop opens this QR to scan with their phone (mirrors InstallPWA's DesktopInstructions). Toggle 'Desktop' above to see it wired into 01 / 02 / 05."
            >
                <Button variant="stroke" onClick={() => setQrModal(true)}>
                    Open scan-to-download
                </Button>
            </Section>

            {/* shared QR modal — opened by any desktop download CTA */}
            <ActionModal
                visible={qrModal}
                onClose={() => setQrModal(false)}
                icon="qr-code"
                title="Scan to download Peanut"
                description="Pick your phone's store, then scan the code with your camera."
                content={<DownloadQR />}
                ctas={[{ text: 'Done', variant: 'purple', shadowSize: '4', onClick: () => setQrModal(false) }]}
            />
        </div>
    )
}

// mirrors the real claim/request page: centered header -> PeanutActionDetailsCard hero
// (avatar + "alice sent you" + big amount) -> Continue with Peanut -> Divider -> ActionListCard rows.
const GUEST = {
    claim: { header: 'Receive', tx: 'CLAIM_LINK', name: 'alice', amount: '25', message: '' },
    request: { header: 'Pay', tx: 'REQUEST_PAYMENT', name: 'bob', amount: '40', message: 'for dinner' },
    invite: { header: 'Receive', tx: 'CLAIM_LINK', name: 'carol', amount: '25', message: '' },
} satisfies Record<
    string,
    { header: string; tx: PeanutActionDetailsCardTransactionType; name: string; amount: string; message: string }
>

function GuestPage({ kind, onCta }: { kind: 'claim' | 'request' | 'invite'; onCta: () => void }) {
    const c = GUEST[kind]
    return (
        <div className="mx-auto flex h-[600px] w-full max-w-[360px] flex-col justify-between gap-6 overflow-hidden rounded-sm border border-n-1 bg-white p-5">
            <div className="pb-1 text-center text-2xl font-extrabold text-n-1">{c.header}</div>
            <div className="my-auto flex flex-col gap-4">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType={c.tx}
                    recipientType="USERNAME"
                    recipientName={c.name}
                    amount={c.amount}
                    tokenSymbol={PEANUT_WALLET_TOKEN_SYMBOL}
                    message={c.message}
                />
                {kind === 'invite' && (
                    <div className="flex items-center justify-center gap-1">
                        <Image src={starImage.src} alt="" width={18} height={18} />
                        <p className="text-center text-sm">Invited by {c.name}, you have early access!</p>
                        <Image src={starImage.src} alt="" width={18} height={18} />
                    </div>
                )}
                <div className="space-y-2">
                    <ContinueWithPeanut onClick={onCta} />
                    <Divider text="or" />
                    <div>
                        <ActionListCard
                            position="first"
                            leftIcon={<Icon name="bank" size={20} />}
                            title="Bank transfer"
                            description="1-2 business days"
                            onClick={onCta}
                        />
                        <ActionListCard
                            position="last"
                            leftIcon={<Icon name="bank" size={20} />}
                            title="Pix"
                            description="Instant, Brazil"
                            onClick={onCta}
                        />
                    </div>
                </div>
            </div>
            <p className="text-center text-xs text-grey-1">
                Continue with Peanut opens the app — or the store if you don&apos;t have it.
            </p>
        </div>
    )
}
