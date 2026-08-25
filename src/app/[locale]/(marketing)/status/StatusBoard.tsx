import { CloudsCss } from '@/components/LandingPage/CloudsCss'
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
const STATUS_CLOUDS = [
    { top: '18%', width: 150, speed: '45s', direction: 'ltr' as const },
    { top: '62%', width: 170, speed: '50s', direction: 'rtl' as const, delay: '6s' },
]

const BAR_COLORS: Record<BucketState, string> = {
    operational: 'bg-success-1',
    degraded: 'bg-secondary-1',
    down: 'bg-error-5',
    unknown: 'bg-grey-2',
}

const DOT_COLORS = BAR_COLORS

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

    return (
        <div className="bg-background">
            {/* Same treatment as the marketing Hero — pink band, clouds, Roboto
                Flex display face — but without its marquee and CTA: "No fees ·
                Instant · 24/7" scrolling above a live outage is the wrong
                thing to say. */}
            <section className="relative overflow-hidden bg-primary-1 px-4 py-12 text-center md:px-8 md:py-16">
                <CloudsCss clouds={STATUS_CLOUDS} />
                <div className="relative z-10 mx-auto max-w-4xl">
                    <h1 className="font-roboto-flex-extrabold text-[2.5rem] font-extraBlack uppercase leading-[0.95] text-black md:text-[4rem]">
                        {i18n.statusPageTitle}
                    </h1>
                    <p className="font-roboto-flex-extrabold mt-4 text-[1rem] uppercase text-black md:mt-6 md:text-[1.5rem]">
                        {i18n.statusPageSubtitle}
                    </p>
                </div>
            </section>

            <div className="mx-auto w-full max-w-3xl px-6 py-10">
                <div className="flex items-center gap-3 rounded-md border border-grey-2 bg-white p-4">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${DOT_COLORS[summary.state]}`} />
                    <span className="font-bold">{headline(summary.state, i18n)}</span>
                </div>

                {STATUS_GROUPS.map((group) => (
                    <section key={group.label(i18n)} className="mt-10">
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
