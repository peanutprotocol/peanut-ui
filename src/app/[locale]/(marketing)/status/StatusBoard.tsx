import { Hero } from '@/components/Marketing/mdx/Hero'
import { t } from '@/i18n'
import { type Translations } from '@/i18n/types'
import {
    incidentImpact,
    incidentReasonLabel,
    STATUS_GROUPS,
    type BucketState,
    type StatusIncident,
    type StatusProvider,
    type StatusSummary,
} from './types'

/* House tokens, not the stock Tailwind palette: tailwind.config.js redefines
   `red` as a single flat colour, so `bg-red-500` compiles to nothing at all
   and the outage bars render transparent. */
const BAR_COLORS: Record<BucketState, string> = {
    operational: 'bg-success-1',
    degraded: 'bg-secondary-1',
    down: 'bg-error-5',
    unknown: 'bg-grey-2',
}

const DOT_COLORS = BAR_COLORS

/**
 * The summary card — donut plus headline — is built, translated and tested,
 * but not rendered: the page opens straight at App & Account. Flip this to
 * bring it back.
 */
const SHOW_SUMMARY_CARD: boolean = false

const RING_STROKES: Record<BucketState, string> = {
    operational: 'stroke-success-1',
    degraded: 'stroke-secondary-1',
    down: 'stroke-error-5',
    unknown: 'stroke-grey-2',
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
                className="fill-n-1 font-bold"
                fontSize="9"
            >
                {percent}%
            </text>
        </svg>
    )
}

function headline(state: BucketState, i18n: Translations): string {
    if (state === 'down') return i18n.statusSomeDown
    if (state === 'degraded') return i18n.statusSomeDegraded
    if (state === 'operational') return i18n.statusAllOperational
    return i18n.statusUnknown
}

/**
 * Rendered on the server, so an unqualified `toLocaleString` would format in
 * whatever zone the host happens to run in and give the reader nothing to
 * interpret it against. Pinned to UTC, and the page states that it is.
 */
function formatTime(iso: string, locale: string): string {
    return new Date(iso).toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
    })
}

/**
 * One bar per hour. Bars carry a `title` rather than a custom tooltip so the
 * hour and its failure count stay reachable on a server-rendered page with no
 * client JS — this page has to work when everything else is on fire.
 */
function UptimeBars({ provider, locale, i18n }: { provider: StatusProvider; locale: string; i18n: Translations }) {
    return (
        <div className="flex h-8 items-stretch gap-[2px]" role="img" aria-label={i18n.statusWindowLabel}>
            {provider.buckets.map((bucket) => (
                <span
                    key={bucket.hourStart}
                    className={`flex-1 rounded-[1px] ${BAR_COLORS[bucket.state]}`}
                    title={`${formatTime(bucket.hourStart, locale)} — ${
                        bucket.state === 'unknown' ? i18n.statusLegendNoData : `${bucket.failures}/${bucket.checks}`
                    }`}
                />
            ))}
        </div>
    )
}

function IncidentList({
    incidents,
    serviceKey,
    locale,
    i18n,
}: {
    incidents: StatusIncident[]
    serviceKey: string
    locale: string
    i18n: Translations
}) {
    if (incidents.length === 0) return null
    return (
        <ul className="mt-3 space-y-2 border-l-2 border-grey-2 pl-3">
            {incidents.map((incident) => (
                <li key={incident.id} className="text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`rounded px-1.5 py-0.5 font-bold uppercase tracking-wide ${
                                incident.resolvedAt ? 'bg-grey-4 text-grey-1' : 'bg-error-1 text-error'
                            }`}
                        >
                            {incident.resolvedAt ? i18n.statusIncidentResolved : i18n.statusIncidentOngoing}
                        </span>
                        <time dateTime={incident.startedAt} className="text-grey-1">
                            {formatTime(incident.startedAt, locale)}
                            {incident.resolvedAt ? ` → ${formatTime(incident.resolvedAt, locale)}` : ''}
                        </time>
                    </div>
                    <p className="mt-1 break-words text-n-1">
                        {incidentImpact(serviceKey, i18n)}{' '}
                        <span className="text-grey-1">{incidentReasonLabel(incident.reason, i18n)}</span>
                    </p>
                </li>
            ))}
        </ul>
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
        <div className="bg-background">
            {/* The same Hero every marketing page uses (privacy, pricing, help),
                so the pink band, its height, and the yellow marquee below it
                match exactly. Subtitle is the window label rather than the
                metadata description — a full sentence wraps to three lines at
                the Hero's uppercase 2rem. */}
            <Hero title={i18n.statusPageTitle} subtitle={i18n.statusWindowLabel} />

            <div className="mx-auto w-full max-w-3xl px-6 pb-12">
                {SHOW_SUMMARY_CARD && (
                    <div className="flex items-center gap-4 rounded-md border border-grey-2 bg-white p-4">
                        <OperationalDonut
                            operational={operationalCount}
                            total={summary.providers.length}
                            worstState={summary.state}
                            percent={percent}
                            label={ratioLabel}
                        />
                        <div>
                            <p className="text-lg font-bold">{headline(summary.state, i18n)}</p>
                            <p className="mt-1 text-sm text-grey-1">
                                {t(i18n.statusServicesOperationalCount, {
                                    operational: String(operationalCount),
                                    total: String(summary.providers.length),
                                })}
                            </p>
                        </div>
                    </div>
                )}

                {STATUS_GROUPS.map((group) => (
                    <section key={group.label(i18n)} className="mt-10 first:mt-0">
                        <h2 className="text-xs font-bold uppercase tracking-wide text-grey-1">{group.label(i18n)}</h2>
                        <div className="mt-3 space-y-6">
                            {group.services.map((service) => {
                                const provider = byKey.get(service.key)
                                if (!provider) return null
                                return (
                                    <div key={service.key}>
                                        <div className="flex items-baseline justify-between gap-4">
                                            <span className="flex items-center gap-2 text-sm font-bold">
                                                <span
                                                    className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[provider.state]}`}
                                                />
                                                {service.label(i18n)}
                                            </span>
                                            {provider.uptimePct !== null && (
                                                <span className="text-xs text-grey-1">
                                                    {provider.uptimePct.toFixed(2)}% {i18n.statusUptimeLabel}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <UptimeBars provider={provider} locale={locale} i18n={i18n} />
                                            <div className="mt-1 flex justify-between text-[10px] text-grey-1">
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

                <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-grey-2 pt-4 text-[11px] text-grey-1">
                    {(
                        [
                            ['operational', i18n.statusLegendOperational],
                            ['degraded', i18n.statusLegendDegraded],
                            ['down', i18n.statusLegendDown],
                            ['unknown', i18n.statusLegendNoData],
                        ] as Array<[BucketState, string]>
                    ).map(([state, label]) => (
                        <span key={state} className="flex items-center gap-1.5">
                            <span className={`h-2 w-4 rounded-[1px] ${BAR_COLORS[state]}`} />
                            {label}
                        </span>
                    ))}
                    <span className="ml-auto">{i18n.statusTimesInUtc}</span>
                </div>
            </div>
        </div>
    )
}
