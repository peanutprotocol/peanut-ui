'use client'

import { useExchangeRate } from '@/hooks/useExchangeRate'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { PROSE_WIDTH } from './constants'

interface CompareSavingsProps {
    /** Competitor name as it should read in the sentence, e.g. "Wise". */
    competitor: string
    /**
     * The competitor's fee in **PERCENT units**, not a fraction. `"4"` means 4%.
     * A range is written `"0.4-1.5"` (an en dash is accepted too).
     *
     * ⚠️ The 100× trap: writing `"0.04"` for 4% publishes a claim a hundred
     * times too small, and nothing downstream can tell the difference.
     */
    markupPct: string
    /** ISO date the claim was last checked against its source, e.g. "2026-08-10". */
    verifiedAt: string
    /** ISO 4217 destination currency. Defaults to ARS. */
    currency?: string
    /** USD amount the example is built on. Defaults to 500. */
    baseAmount?: string
    /** Public page the claim was verified against. */
    sourceUrl?: string
    /** Injected by createMdxComponents — never authored in MDX. */
    locale?: Locale
}

const MAX_PLAUSIBLE_PCT = 50
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface Claim {
    min: number
    max: number
    verifiedAt: Date
    baseAmount: number
}

/**
 * MDX props are string literals — `mdx-security` rejects any expression prop —
 * so every value arrives as text and has to be proven here.
 */
function parseClaim({ markupPct, verifiedAt, baseAmount }: CompareSavingsProps): Claim | null {
    // A leading minus would split into an empty first part, and Number('') is
    // 0 — so "-2" would quietly publish as the range "0–2".
    if (/^\s*[-–—]/.test(markupPct)) return null
    const parts = markupPct.replace(/[–—]/g, '-').split('-')
    if (parts.length > 2) return null
    const [min, max] = [Number(parts[0]), Number(parts[parts.length - 1])]
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null
    // A zero floor is a real claim ("free on weekdays"), so only the upper
    // bound has to be positive — there must be some cost to state.
    if (min < 0 || max <= 0 || max >= MAX_PLAUSIBLE_PCT || min > max) return null

    // Date rolls an overflow forward instead of rejecting it: "2026-02-30"
    // becomes 2 March. The date is hand-authored in MDX, so a typo would
    // publish a verification date that never happened. Round-trip it.
    if (!ISO_DATE.test(verifiedAt)) return null
    const verified = new Date(`${verifiedAt}T00:00:00.000Z`)
    if (Number.isNaN(verified.getTime())) return null
    if (verified.toISOString().slice(0, 10) !== verifiedAt) return null

    const base = baseAmount === undefined ? 500 : Number(baseAmount)
    if (!Number.isFinite(base) || base <= 0) return null

    return { min, max, verifiedAt: verified, baseAmount: base }
}

const formatPct = (value: number): string => String(Number(value.toFixed(2)))
const formatRange = (min: number, max: number): string =>
    min === max ? formatPct(min) : `${formatPct(min)}–${formatPct(max)}`

/**
 * Live "what this competitor costs you" line for a `/compare/*` page.
 *
 * Two lanes, and the fallback lane is the important one: content pages are
 * statically generated, so the sentence rendered without a rate is what search
 * engines and a JS-less reader see. It must therefore be complete, concrete,
 * and dated on its own — computed from the verified claim alone, no live rate
 * involved. The live lane then adds today's local-currency amounts on top.
 *
 * Never throws and never renders empty: content auto-publishes without review,
 * and an unparsable prop must degrade to a weaker sentence rather than break
 * the page build.
 *
 * Usage in MDX:
 *   <CompareSavings competitor="Wise" markupPct="0.4-1.5" verifiedAt="2026-08-10"
 *     currency="ARS" sourceUrl="https://wise.com/pricing/" />
 */
export function CompareSavings(props: CompareSavingsProps) {
    const { competitor, markupPct, verifiedAt, currency = 'ARS', sourceUrl, locale = DEFAULT_LOCALE } = props
    const claim = parseClaim(props)

    const { exchangeRate } = useExchangeRate({
        sourceCurrency: 'USD',
        destinationCurrency: currency,
        enabled: claim !== null,
    })

    const verifiedLabel = claim
        ? // An ISO date parses as UTC midnight. Without an explicit UTC zone
          // the server and a viewer west of Greenwich format different days,
          // which on a statically generated page is a hydration mismatch.
          new Intl.DateTimeFormat(locale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC',
          }).format(claim.verifiedAt)
        : verifiedAt

    const source = sourceUrl ? (
        <>
            {' '}
            <a href={sourceUrl} rel="nofollow noopener" className="underline decoration-n-1/30 underline-offset-2">
                Source
            </a>
            .
        </>
    ) : null

    // Degraded lane: the claim itself did not parse, so state it without doing
    // arithmetic on numbers we could not validate.
    if (!claim) {
        return (
            <Frame>
                As of {verifiedLabel}, {competitor} charges around {markupPct}% to convert your money. Peanut&apos;s
                rate is live and indicative.{source}
            </Frame>
        )
    }

    const worstCaseUsd = (claim.baseAmount * claim.max) / 100
    const rangeLabel = formatRange(claim.min, claim.max)
    const usd = (value: number) => `$${value.toLocaleString(locale, { maximumFractionDigits: 2 })}`
    const local = (value: number) => `${Math.round(value).toLocaleString(locale)} ${currency}`

    // Static lane — no live rate yet (server render, loading, or an outage).
    // Concrete and dated, so it stands alone in the static HTML.
    if (!(exchangeRate > 0)) {
        return (
            <Frame>
                As of {verifiedLabel}, {competitor} charges {rangeLabel}% to convert your money — up to about{' '}
                {usd(worstCaseUsd)} on a {usd(claim.baseAmount)} transfer. Peanut&apos;s rate is live and indicative.
                {source}
            </Frame>
        )
    }

    return (
        <Frame>
            {usd(claim.baseAmount)} with Peanut is about {local(claim.baseAmount * exchangeRate)} today. {competitor}
            &apos;s {rangeLabel}% conversion fee costs you up to about {usd(worstCaseUsd)} (
            {local(worstCaseUsd * exchangeRate)}) of that. Competitor fees were verified on {verifiedLabel} and change
            over time.{source}
        </Frame>
    )
}

function Frame({ children }: { children: React.ReactNode }) {
    return (
        <div className={`mx-auto ${PROSE_WIDTH} px-6 md:px-4`}>
            <p className="my-6 border-l-4 border-primary-1 py-1 pl-5 text-base leading-[1.75] text-grey-1">
                {children}
            </p>
        </div>
    )
}
