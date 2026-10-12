'use client'

import Badge from '@/components/Global/Badges/Badge'
import { type Translations } from '@/i18n/types'
import { formatTime, incidentImpact, incidentReasonLabel, type StatusIncident } from './types'

/**
 * Incident rows under one service.
 *
 * Its own client module only because `Badge` reads its label through
 * next-intl's hook, which this app resolves on the client only — there is no
 * `i18n/request.ts`, so the hook cannot run in a server component. The rows
 * hold no state and still render in full without JS; the rest of the board
 * stays server-only.
 *
 * `completed` / `failed` rather than `custom`: the badge palette has no neutral
 * grey, and a resolved incident reading green while an ongoing one reads red is
 * the distinction this list exists to draw. The words are the page's own.
 */
export function IncidentList({
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
        <ul className="space-y-2 mt-3 border-l-2 border-border-subtle pl-3">
            {incidents.map((incident) => (
                <li key={incident.id} className="text-body-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            status={incident.resolvedAt ? 'completed' : 'failed'}
                            customText={incident.resolvedAt ? i18n.statusIncidentResolved : i18n.statusIncidentOngoing}
                        />
                        <time dateTime={incident.startedAt} className="text-foreground-secondary">
                            {formatTime(incident.startedAt, locale)}
                            {incident.resolvedAt ? ` → ${formatTime(incident.resolvedAt, locale)}` : ''}
                        </time>
                    </div>
                    <p className="mt-1 break-words text-foreground-primary">
                        {incidentImpact(serviceKey, i18n)}{' '}
                        <span className="text-foreground-secondary">{incidentReasonLabel(incident.reason, i18n)}</span>
                    </p>
                </li>
            ))}
        </ul>
    )
}
