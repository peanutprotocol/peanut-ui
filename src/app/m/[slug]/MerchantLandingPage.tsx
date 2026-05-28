'use client'

import { Fragment, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/0_Bruddle/Button'
import { Marquee } from '@/components/LandingPage'
import { FAQsPanel } from '@/components/Global/FAQs'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { Sparkle, Star } from '@/assets/illustrations'
import { getArsCardMarkup } from './card-comparison'
import type { Merchant, MenuItem } from './merchants'

/** Documented empirical ARS card-vs-Peanut spread + issuer markup — used
 *  as the immediate render value and the fallback when the live fetch fails.
 *  Mirrors `CARD_FX_MARKUP_BY_CURRENCY.ARS` from PR #2108. */
const ARS_CARD_MARKUP_FALLBACK = 0.0913

/**
 * Client wrapper around the `getArsCardMarkup` server action — keeps the
 * third-party dolarapi.com call off the client and lets Next edge-cache the
 * response for 5min. React-query layers an additional 5min client cache and
 * re-fetches on focus so the displayed savings stays fresh without us having
 * to think about it. Returns the static fallback while loading so the menu
 * cards and banner can render unconditionally.
 */
function useCardMarkupArs(criptoUsdToArs: number): number {
    const { data } = useQuery({
        queryKey: ['merchantLpArsCardMarkup', criptoUsdToArs > 0 ? Math.round(criptoUsdToArs) : 0],
        queryFn: () => getArsCardMarkup(criptoUsdToArs),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
        enabled: criptoUsdToArs > 0,
    })
    return data?.rate ?? ARS_CARD_MARKUP_FALLBACK
}

const ctaButtonClassName =
    '!w-auto bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl'

type Currency = 'USD' | 'EUR'

export default function MerchantLandingPage({ merchant }: { merchant: Merchant }) {
    const marqueeProps = { visible: true, message: merchant.marquee }

    return (
        <>
            <Hero merchant={merchant} />
            <Marquee {...marqueeProps} />
            {merchant.fold2.type === 'menu' ? <MenuFold fold={merchant.fold2} /> : <FaqFold fold={merchant.fold2} />}
            <Marquee {...marqueeProps} />
            <EndFold merchant={merchant} />
            {merchant.footerDisclosure && (
                <div className="bg-n-1 px-4 py-3 text-center text-xs text-white/65">{merchant.footerDisclosure}</div>
            )}
        </>
    )
}

/* ---------------------------------------------------------------------------
 * §1 — Hero (pink). Mirrors /shhhhh hero: 1.1fr 0.9fr grid, lowercase huge h1,
 * uppercase sub with highlight pill, regular body, white button + secondary link,
 * tilted card visual on the right (yellow deal card here vs PixelatedCardFace in /shhhhh).
 * ------------------------------------------------------------------------- */
function Hero({ merchant }: { merchant: Merchant }) {
    return (
        <section className="relative overflow-hidden bg-primary-1 px-4 py-20 text-n-1 md:py-24">
            <motion.img
                src={Star.src}
                alt=""
                aria-hidden
                initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                transition={{ type: 'spring', damping: 5 }}
                className="pointer-events-none absolute left-[3%] top-[8%] z-10 w-10 md:left-[6%] md:top-[12%] md:w-14"
            />
            <motion.img
                src={Star.src}
                alt=""
                aria-hidden
                initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                transition={{ type: 'spring', damping: 5, delay: 0.15 }}
                className="pointer-events-none absolute bottom-[5%] right-[4%] z-10 w-8 md:bottom-[8%] md:right-[8%] md:w-12"
            />
            <motion.img
                src={Sparkle.src}
                alt=""
                aria-hidden
                initial={{ opacity: 0, scale: 0.4 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 8, delay: 0.3 }}
                className="pointer-events-none absolute right-[12%] top-[10%] z-10 hidden w-8 md:block md:w-10"
            />

            <div className="relative z-20 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
                <div className="min-w-0 text-center md:text-left">
                    <h1 className="font-roboto-flex-extrabold text-headingMedium font-extraBlack lowercase md:text-headingLarge lg:text-[10rem]">
                        {merchant.heading}
                    </h1>
                    <p className="font-roboto-flex-extrabold mt-6 max-w-xl text-2xl font-extraBlack uppercase md:text-3xl">
                        <HighlightedSub text={merchant.sub} />
                    </p>
                    <p className="font-roboto-flex mt-6 max-w-xl text-xl leading-relaxed md:text-2xl">
                        {merchant.body}
                    </p>

                    {merchant.chips && (
                        <div className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start">
                            {merchant.chips.map((c) => (
                                <span
                                    key={c}
                                    className="rounded-sm border border-n-1 bg-black/10 px-3 py-1.5 text-[0.7rem] font-extraBlack uppercase tracking-wider"
                                >
                                    {c}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="mt-8 flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-6">
                        <div className="relative">
                            <Link
                                href={`/invite?code=SQUIRRELINVITESYOU&utm_medium=merchant&utm_source=m&utm_campaign=${merchant.slug}`}
                                className="inline-block"
                            >
                                <Button shadowSize="4" className={ctaButtonClassName}>
                                    {merchant.primaryCta}
                                </Button>
                            </Link>
                            <motion.img
                                src={Sparkle.src}
                                alt=""
                                aria-hidden
                                initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 10, delay: 0.6 }}
                                className="pointer-events-none absolute -right-4 -top-4 w-8 md:-right-5 md:-top-5 md:w-10"
                            />
                        </div>
                        <Link
                            href={merchant.secondaryLink.href}
                            className="font-roboto-flex text-base font-bold underline underline-offset-4"
                        >
                            {merchant.secondaryLink.label}
                        </Link>
                    </div>
                </div>

                <div className="relative mx-auto flex h-[330px] w-full max-w-[340px] items-center justify-center md:h-[440px] md:max-w-none">
                    {merchant.polaroids && <Polaroids items={merchant.polaroids} />}
                    <DealCard merchant={merchant} />
                </div>
            </div>
        </section>
    )
}

/* Wraps any `$NN` (e.g. `$10`) in the same pill the /shhhhh ScarcityCounter uses. */
function HighlightedSub({ text }: { text: string }) {
    const parts = text.split(/(\$\d+)/)
    return (
        <>
            {parts.map((p, i) =>
                /^\$\d+$/.test(p) ? (
                    <span
                        key={i}
                        className="mx-1 inline-block whitespace-nowrap bg-n-1 px-2 py-0.5 text-[0.92em] font-extraBlack uppercase tracking-wider text-primary-1"
                    >
                        {p}
                    </span>
                ) : (
                    <Fragment key={i}>{p}</Fragment>
                )
            )}
        </>
    )
}

/* Yellow tilted $10 voucher behind the polaroids. The amount dominates the
 * card — lockup + label are thin top/bottom bands so the $10 fills the middle.
 * z-30: the voucher sits ON TOP, with the polaroids (z-0) fanned out behind it
 * so the $10 stays fully legible and the photos peek around the edges. -6deg tilt. */
function DealCard({ merchant }: { merchant: Merchant }) {
    const lockupName =
        merchant.branding?.lockupName ?? (merchant.slug === 'badigitalnomads' ? 'ba nomads' : merchant.slug)
    return (
        <div className="relative z-30 origin-center" style={{ transform: 'rotate(-6deg)' }} aria-hidden>
            <div className="w-[260px] overflow-hidden rounded-sm border-2 border-n-1 bg-secondary-1 shadow-[8px_8px_0_#000] md:w-[300px]">
                {/* cobrand lockup */}
                <div
                    className="flex items-center gap-1.5 px-6 pb-2 pt-5 uppercase tracking-wider"
                    style={{ fontFamily: 'monospace', fontSize: 11 }}
                >
                    <span>peanut ×</span>
                    {merchant.branding?.logoSrc && (
                        <Image
                            src={merchant.branding.logoSrc}
                            alt=""
                            width={16}
                            height={16}
                            className="inline-block border border-n-1"
                        />
                    )}
                    <span>{lockupName}</span>
                </div>

                {/* amount — one kerned unit on one baseline; leading-none so the
                    line box equals the font size and nothing rides into the lockup */}
                <div className="font-roboto-flex-extrabold px-6 text-center text-[84px] font-extraBlack leading-none md:text-[100px]">
                    $10
                </div>

                {/* label */}
                <div className="px-6 pb-6 pt-3 text-center text-base font-extraBlack uppercase tracking-wide md:text-lg">
                    {merchant.dealLabel}
                </div>
            </div>
        </div>
    )
}

/* Polaroid-style venue photos thrown on top of the $10 voucher. Shown on ALL
 * viewports (this LP is used almost exclusively on mobile).
 *
 * Each polaroid is absolutely positioned against the hero visual stage and sits
 * BEHIND the voucher (z-0; voucher is z-30), fanned out from opposite corners so
 * the photos peek around the voucher while the $10 stays fully legible:
 * - tl → fans out top-left
 * - br → fans out bottom-right
 * Sizes scale up at md+. See mono/inbox/merchant-landing-pages/previews/polaroid-stain.png. */
function Polaroids({ items }: { items: NonNullable<Merchant['polaroids']> }) {
    return (
        <>
            {items.map((p, i) => {
                const posClass =
                    p.position === 'tl'
                        ? 'absolute -left-6 -top-8 z-0 md:-left-10 md:-top-10'
                        : 'absolute -bottom-8 -right-6 z-0 md:-bottom-10 md:-right-10'
                return (
                    <motion.div
                        key={p.src}
                        className={`pointer-events-none ${posClass}`}
                        initial={{ opacity: 0, scale: 0.85, rotate: 0 }}
                        animate={{ opacity: 1, scale: 1, rotate: p.rotation }}
                        transition={{ type: 'spring', damping: 12, delay: 0.15 + i * 0.1 }}
                        style={{ transformOrigin: 'center center' }}
                    >
                        <div className="border-2 border-n-1 bg-white p-1.5 pb-5 shadow-[5px_6px_0_#000] md:p-2 md:pb-9 md:shadow-[8px_10px_0_#000]">
                            <Image
                                src={p.src}
                                alt={p.alt}
                                width={200}
                                height={200}
                                className="block h-[128px] w-[128px] object-cover md:h-[200px] md:w-[200px]"
                            />
                            <div
                                className="mt-1 text-center text-[10px] md:mt-2 md:text-sm"
                                style={{ fontFamily: 'monospace' }}
                            >
                                {p.caption}
                            </div>
                        </div>
                    </motion.div>
                )
            })}
        </>
    )
}

/* ---------------------------------------------------------------------------
 * §2 (menu variant) — Yellow. Mirrors /shhhhh §2 stat-card layout: yellow bg,
 * uppercase centered h2, body tagline, then a grid of white cards with the
 * same border / 4px shadow primitive used by stats.
 * ------------------------------------------------------------------------- */
function MenuFold({ fold }: { fold: Extract<Merchant['fold2'], { type: 'menu' }> }) {
    const [currency, setCurrency] = useState<Currency>('USD')

    // Live ARS rates from the same source as the currency widget (/api/exchange-rate
    // via useExchangeRate). Both pairs are prefetched so the USD/EUR toggle is instant.
    // exchangeRate is 0 until loaded — we show a loading dash rather than a fake rate.
    const { exchangeRate: usdArs } = useExchangeRate({
        sourceCurrency: 'USD',
        destinationCurrency: 'ARS',
        enabled: fold.showLiveRate,
    })
    const { exchangeRate: eurArs } = useExchangeRate({
        sourceCurrency: 'EUR',
        destinationCurrency: 'ARS',
        enabled: fold.showLiveRate,
    })
    const arsPerUnit = currency === 'USD' ? usdArs : eurArs
    const cardMarkup = useCardMarkupArs(usdArs)

    return (
        <section id="menu" className="relative overflow-hidden bg-secondary-1 px-4 py-24 text-center text-n-1 md:py-32">
            <div className="mx-auto max-w-5xl">
                <h2 className="font-roboto-flex-extrabold mx-auto max-w-3xl text-heading font-extraBlack uppercase md:text-headingMedium">
                    {fold.heading}
                </h2>
                <p className="font-roboto-flex mx-auto mt-6 max-w-2xl text-lg leading-relaxed md:text-xl">
                    {fold.tagline}
                </p>

                <div className="mt-10 inline-flex rounded-sm border-2 border-n-1 bg-white shadow-[4px_4px_0_#000]">
                    {(['USD', 'EUR'] as const).map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setCurrency(c)}
                            aria-pressed={currency === c}
                            className={`min-w-[80px] border-r-2 border-n-1 px-6 py-3.5 text-sm font-extraBlack uppercase tracking-wider last:border-r-0 ${
                                currency === c ? 'bg-primary-1' : 'bg-white'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                {fold.showLiveRate && <LiveRateBanner usdArs={usdArs} cardMarkup={cardMarkup} />}

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {fold.items.map((item) => (
                        <MenuItemCard
                            key={item.name}
                            item={item}
                            currency={currency}
                            arsPerUnit={arsPerUnit}
                            cardMarkup={cardMarkup}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}

function MenuItemCard({
    item,
    currency,
    arsPerUnit,
    cardMarkup,
}: {
    item: MenuItem
    currency: Currency
    /** ARS per 1 unit of the selected currency. 0 until the live rate loads. */
    arsPerUnit: number
    /** Card-vs-Peanut markup (fraction). card price = peanut × (1 + cardMarkup). */
    cardMarkup: number
}) {
    const symbol = currency === 'USD' ? '$' : '€'
    const peanutPrice = arsPerUnit > 0 ? item.priceARS / arsPerUnit : null
    const peanutFmt = peanutPrice !== null ? peanutPrice.toFixed(2) : null
    const cardFmt = peanutPrice !== null && cardMarkup > 0 ? (peanutPrice * (1 + cardMarkup)).toFixed(2) : null

    return (
        <div className="flex items-start justify-between gap-4 rounded-sm border-2 border-n-1 bg-white p-5 text-left shadow-[4px_4px_0_#000]">
            <div className="min-w-0 flex-1">
                <div className="text-lg font-extraBlack md:text-xl">{item.name}</div>
            </div>
            <div className="flex flex-col items-end whitespace-nowrap pt-1">
                {cardFmt !== null && (
                    <div className="font-roboto-flex-extrabold text-base font-extraBlack leading-none line-through opacity-45">
                        {symbol}
                        {cardFmt}
                    </div>
                )}
                <div
                    className={`font-roboto-flex-extrabold text-3xl font-extraBlack leading-none ${cardFmt !== null ? 'mt-1' : ''}`}
                >
                    {peanutFmt === null ? (
                        <span className="opacity-30">{symbol}··</span>
                    ) : (
                        <>
                            {symbol}
                            {peanutFmt}
                            <span className="ml-1 text-[11px] font-extraBlack tracking-wider opacity-60">
                                {currency}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function LiveRateBanner({ usdArs, cardMarkup }: { usdArs: number; cardMarkup: number }) {
    const isLive = usdArs > 0
    const savingsPct = cardMarkup > 0 ? Math.round(cardMarkup * 100) : 0
    const copy = isLive
        ? `Live · 1 USD = ${Math.round(usdArs).toLocaleString('en-US')} ARS${savingsPct > 0 ? ` · save ~${savingsPct}% vs card` : ''}`
        : 'Loading live cripto-dólar rate…'

    return (
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-4 rounded-sm border-2 border-n-1 bg-white px-5 py-3 text-sm font-extraBlack uppercase tracking-wider shadow-[4px_4px_0_#000]">
            <span
                className={`inline-block h-2 w-2 rounded-full ${isLive ? 'bg-green-1' : 'bg-n-1'}`}
                style={isLive ? {} : { animation: 'pulse 1.6s ease-in-out infinite' }}
            />
            <span>{copy}</span>
            <span className="text-[9px] uppercase tracking-wider opacity-65" style={{ fontFamily: 'monospace' }}>
                cripto-dólar · live
            </span>
        </div>
    )
}

/* ---------------------------------------------------------------------------
 * §2 (faq variant) — FAQsPanel is self-contained (own cream bg, own padding).
 * The blue-dollar answer is replaced at render time with live data when present.
 * ------------------------------------------------------------------------- */
function FaqFold({ fold }: { fold: Extract<Merchant['fold2'], { type: 'faq' }> }) {
    const { exchangeRate: usdArs } = useExchangeRate({ sourceCurrency: 'USD', destinationCurrency: 'ARS' })
    const questions = useMemo(() => {
        if (!fold.liveRateQuestionId || usdArs <= 0) return fold.questions
        return fold.questions.map((q) => {
            if (q.id !== fold.liveRateQuestionId) return q
            const arsRounded = Math.round(usdArs).toLocaleString('en-US')
            return {
                id: q.id,
                question: q.question,
                answer: `Peanut uses the cripto-dólar rate — currently 1 USD ≈ ${arsRounded} ARS. That's meaningfully better than what your credit card delivers in Argentina. The exact rate locks the moment you confirm; no slippage after.`,
            }
        })
    }, [fold, usdArs])

    return (
        <div id="faq">
            <FAQsPanel heading={fold.heading} questions={questions} />
        </div>
    )
}

/* ---------------------------------------------------------------------------
 * §3 — Get peanut. Mirrors /shhhhh §7 "ready?": black bg, lowercase huge h2,
 * uppercase sub, white Button with shadowSize="4". Optional ambassador box for BA.
 * ------------------------------------------------------------------------- */
function EndFold({ merchant }: { merchant: Merchant }) {
    return (
        <section className="relative overflow-hidden bg-n-1 px-4 py-32 text-center text-white md:py-40">
            <motion.img
                src={Sparkle.src}
                alt=""
                aria-hidden
                initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 8 }}
                className="pointer-events-none absolute left-[8%] top-[18%] w-10 md:left-[15%] md:top-[20%] md:w-14"
            />
            <motion.img
                src={Sparkle.src}
                alt=""
                aria-hidden
                initial={{ opacity: 0, scale: 0.4, rotate: 30 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 8, delay: 0.2 }}
                className="pointer-events-none absolute bottom-[20%] right-[10%] w-8 md:bottom-[24%] md:right-[18%] md:w-12"
            />
            <div className="relative z-10 mx-auto max-w-3xl">
                <h2 className="font-roboto-flex-extrabold text-headingMedium font-extraBlack lowercase md:text-headingLarge">
                    get peanut.
                </h2>
                <p className="font-roboto-flex-extrabold mt-6 text-2xl font-extraBlack uppercase md:text-3xl">
                    {merchant.install.sub}
                </p>
                <div className="mt-10 flex justify-center">
                    <Link
                        href={`/invite?code=SQUIRRELINVITESYOU&utm_medium=merchant&utm_source=m&utm_campaign=${merchant.slug}`}
                        className="inline-block"
                    >
                        <Button shadowSize="4" className={ctaButtonClassName}>
                            INSTALL PEANUT
                        </Button>
                    </Link>
                </div>
                <Link
                    href="/home"
                    className="font-roboto-flex mt-6 inline-block text-base font-bold text-white underline underline-offset-4 hover:opacity-80"
                >
                    Already have peanut? Open it →
                </Link>
            </div>
        </section>
    )
}
