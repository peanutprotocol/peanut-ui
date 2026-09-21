import { Hero } from '@/components/Marketing/mdx/Hero'
import { Card } from '@/components/0_Bruddle/Card'
import { Callout } from '@/components/0_Bruddle/Callout'
import { t } from '@/i18n'
import { type Translations } from '@/i18n/types'
import { IncidentList } from './IncidentList'
import {
    formatTime,
    STATUS_GROUPS,
    type BucketState,
    type StatusBucket,
    type StatusProvider,
    type StatusSummary,
} from './types'

/* House tokens, not the stock Tailwind palette: tailwind.config.js redefines
   `red` as a single flat colour, so `bg-red-500` compiles to nothing at all
   and the outage bars render transparent. */
// the icon-bubble and badge tokens are the only declared greens/yellows/reds in
// the semantic set, so status fills borrow them. using a bubble token as a bar
// fill is a naming gap — tracked in design.md open-conflicts.
const BAR_COLORS: Record<BucketState, string> = {
    operational: 'bg-background-icon-bubble-green',
    degraded: 'bg-background-icon-bubble-yellow',
    down: 'bg-background-icon-bubble-red',
    unknown: 'bg-background-icon-bubble-gray',
}

const DOT_COLORS = BAR_COLORS

/**
 * The summary card — donut plus headline — is built, translated and tested,
 * but not rendered: the page opens straight at App & Account. Flip this to
 * bring it back.
 */
const SHOW_SUMMARY_CARD: boolean = false

const RING_STROKES: Record<BucketState, string> = {
    operational: 'stroke-background-icon-bubble-green',
    degraded: 'stroke-background-icon-bubble-yellow',
    down: 'stroke-background-icon-bubble-red',
    unknown: 'stroke-background-icon-bubble-gray',
}

/**
 * Donut of how many services are operational right now.
 *
 * Hand-rolled SVG rather than a chart library: this page has to render when
 * the rest of the system is on fire, so it ships no client JS at all. The
 * remaining arc takes the colour of the worst state present, so the shape says
 * how much is broken and the colour says how badly.
 */
/**
 * Share of Peanut that is working, as a percentage.
 *
 * The app and website carry half the figure on their own, and the rails split
 * the other half. A user who cannot open Peanut at all has lost more than
 * someone who can use everything except one deposit rail, and a flat
 * per-service average would score those two the same.
 */
export function operationalScore(providers: StatusProvider[]): { operationalCount: number; percent: number } {
    const operationalCount = providers.filter((p) => p.state === 'operational').length
    const app = providers.find((p) => p.provider === 'app')
    const rails = providers.filter((p) => p.provider !== 'app')
    const railsOperational = rails.filter((p) => p.state === 'operational').length

    const raw = app
        ? (app.state === 'operational' ? 50 : 0) + (rails.length === 0 ? 50 : (railsOperational / rails.length) * 50)
        : providers.length === 0
          ? 0
          : (operationalCount / providers.length) * 100

    // Never round up to a whole 100% while something is still broken — the
    // headline would say outage while the figure said everything was fine.
    const percent = operationalCount === providers.length ? 100 : Math.min(99, Math.round(raw))
    return { operationalCount, percent }
}

export function OperationalDonut({
    operational,
    total,
    worstState,
    percent,
    label,
}: {
    operational: number
    total: number
    worstState: BucketState
    percent: number
    label: string
}) {
    const fraction = total === 0 ? 0 : operational / total
    const remainderStroke = worstState === 'operational' ? RING_STROKES.unknown : RING_STROKES[worstState]
    const R = 15.5
    const circumference = 2 * Math.PI * R

    return (
        <svg viewBox="0 0 40 40" className="h-36 w-36 shrink-0" role="img" aria-label={label}>
            {/* Rotated so the arc starts at 12 o'clock rather than 3. */}
            <g transform="rotate(-90 20 20)">
                <circle cx="20" cy="20" r={R} fill="none" className={remainderStroke} strokeWidth="7" />
                {fraction > 0 && (
                    <circle
                        cx="20"
                        cy="20"
                        r={R}
                        fill="none"
                        className={RING_STROKES.operational}
                        strokeWidth="7"
                        strokeDasharray={`${(fraction * circumference).toFixed(3)} ${circumference.toFixed(3)}`}
                    />
                )}
            </g>
            <text
                x="20"
                y="20"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground-primary font-bold"
                fontSize="9"
            >
                {percent}%
            </text>
        </svg>
    )
}

/**
 * The page's one-line verdict.
 *
 * Exported because the unreachable-feed fallback in page.tsx renders it too:
 * a frontend that cannot reach the backend has learnt something real about
 * the system's health, and it should say so in the same words and the same
 * colour as an outage the feed reported itself.
 *
 * `unknown` is styled as an outage, not as a neutral third thing. Not knowing
 * whether Peanut is up is a bad state to be in, and a status page that softens
 * it into grey is the reason this page read green through 2026-09-03.
 */
const BANNER_PRIORITY: Record<BucketState, 'success' | 'attention' | 'error'> = {
    operational: 'success',
    degraded: 'attention',
    down: 'error',
    unknown: 'error',
}

export function StatusBanner({ state, title, detail }: { state: BucketState; title: string; detail?: string }) {
    return (
        <Callout priority={BANNER_PRIORITY[state]} title={title}>
            {detail}
        </Callout>
    )
}

function headline(state: BucketState, i18n: Translations): string {
    if (state === 'down') return i18n.statusSomeDown
    if (state === 'degraded') return i18n.statusSomeDegraded
    if (state === 'operational') return i18n.statusAllOperational
    return i18n.statusUnknown
}

/**
 * Why a bar is the colour it is.
 *
 * A red bar holding no checks is not a measured failure — it is an hour the
 * collector could not write, which it can only be because the API it runs
 * inside was down. Same colour, because the user lost the same thing;
 * different words, because "0/0 failures" would read as a bug.
 */
function bucketDetail(bucket: StatusBucket, i18n: Translations): string {
    if (bucket.checks === 0) {
        return bucket.state === 'unknown' ? i18n.statusLegendNoData : i18n.statusBucketNotMonitored
    }
    return `${bucket.failures}/${bucket.checks}`
}

/**
 * One bar per hour. Bars carry a `title` rather than a custom tooltip so the
 * hour and its failure count stay reachable on a server-rendered page with no
 * client JS — this page has to work when everything else is on fire.
 */
function UptimeBars({ provider, locale, i18n }: { provider: StatusProvider; locale: string; i18n: Translations }) {
    return (
        <div className="flex h-8 items-stretch gap-0.5" role="img" aria-label={i18n.statusWindowLabel}>
            {provider.buckets.map((bucket) => (
                <span
                    key={bucket.hourStart}
                    className={`flex-1 rounded-1 ${BAR_COLORS[bucket.state]}`}
                    title={`${formatTime(bucket.hourStart, locale)} — ${bucketDetail(bucket, i18n)}`}
                />
            ))}
        </div>
    )
}

export function StatusBoard({ summary, locale, i18n }: { summary: StatusSummary; locale: string; i18n: Translations }) {
    const byKey = new Map(summary.providers.map((p) => [p.provider, p]))
    const { operationalCount, percent } = operationalScore(summary.providers)
    const ratioLabel = t(i18n.statusServicesOperational, {
        percent: String(percent),
        operational: String(operationalCount),
        total: String(summary.providers.length),
    })

    return (
        <div className="bg-background-page">
            {/* The same Hero every marketing page uses (privacy, pricing, help),
                so the pink band, its height, and the yellow marquee below it
                match exactly. Subtitle is the window label rather than the
                metadata description — a full sentence wraps to three lines at
                the Hero's uppercase 2rem. */}
            <Hero title={i18n.statusPageTitle} subtitle={i18n.statusWindowLabel} />

            <div className="mx-auto w-full max-w-3xl px-6 pb-12">
                {/* Only when something is wrong. A healthy page still opens
                    straight at App & Account, as designed — but during an
                    outage the only sign of it was the colour of a 2px dot some
                    rows down, which is a lot to ask of someone who opened this
                    page because their money is missing. */}
                {summary.state !== 'operational' && (
                    <div className="mb-8">
                        <StatusBanner
                            state={summary.state}
                            title={headline(summary.state, i18n)}
                            detail={t(i18n.statusServicesOperationalCount, {
                                operational: String(operationalCount),
                                total: String(summary.providers.length),
                            })}
                        />
                    </div>
                )}

                {SHOW_SUMMARY_CARD && (
                    <Card className="flex-row items-center gap-4 p-4" shadowSize="4">
                        <OperationalDonut
                            operational={operationalCount}
                            total={summary.providers.length}
                            worstState={summary.state}
                            percent={percent}
                            label={ratioLabel}
                        />
                        <div>
                            <p className="text-heading-card">{headline(summary.state, i18n)}</p>
                            <p className="mt-1 text-body-s text-foreground-secondary">
                                {t(i18n.statusServicesOperationalCount, {
                                    operational: String(operationalCount),
                                    total: String(summary.providers.length),
                                })}
                            </p>
                        </div>
                    </Card>
                )}

                {STATUS_GROUPS.map((group) => (
                    <section key={group.label(i18n)} className="mt-10 first:mt-0">
                        <h2 className="text-label-m tracking-wide text-foreground-secondary uppercase">
                            {group.label(i18n)}
                        </h2>
                        <div className="space-y-6 mt-3">
                            {group.services.map((service) => {
                                const provider = byKey.get(service.key)
                                if (!provider) return null
                                return (
                                    <div key={service.key}>
                                        <div className="flex items-baseline justify-between gap-4">
                                            <span className="flex items-center gap-2 text-label-l">
                                                <span
                                                    className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[provider.state]}`}
                                                />
                                                {service.label(i18n)}
                                            </span>
                                            {provider.uptimePct !== null && (
                                                <span className="text-body-xs text-foreground-secondary">
                                                    {provider.uptimePct.toFixed(2)}% {i18n.statusUptimeLabel}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <UptimeBars provider={provider} locale={locale} i18n={i18n} />
                                            <div className="mt-1 flex justify-between text-body-xs text-foreground-secondary">
                                                <span>{i18n.statusWindowStart}</span>
                                                <span>{i18n.statusNow}</span>
                                            </div>
                                        </div>
                                        <IncidentList
                                            incidents={provider.incidents}
                                            serviceKey={service.key}
                                            locale={locale}
                                            i18n={i18n}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                ))}

                <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-border-subtle pt-4 text-body-xs text-foreground-secondary">
                    {(
                        [
                            ['operational', i18n.statusLegendOperational],
                            ['degraded', i18n.statusLegendDegraded],
                            ['down', i18n.statusLegendDown],
                            ['unknown', i18n.statusLegendNoData],
                        ] as Array<[BucketState, string]>
                    ).map(([state, label]) => (
                        <span key={state} className="flex items-center gap-1">
                            <span className={`h-2 w-4 rounded-1 ${BAR_COLORS[state]}`} />
                            {label}
                        </span>
                    ))}
                    <span className="ml-auto">{i18n.statusTimesInUtc}</span>
                </div>
            </div>
        </div>
    )
}
