'use client'

import { useAuth } from '@/context/authContext'
import { useAttentionOptional } from '@/features/attention/AttentionProvider'
import { useServerAttention } from '@/features/attention/serverAttention'
import { getCatalogue, getSettings } from '@/features/attention/catalogue'
import { decide, isSilenced } from '@/features/attention/decide'
import DevPageShell from '../_components/DevPageShell'

export default function AttentionDebugPage() {
    const { user } = useAuth()
    const attention = useAttentionOptional()
    const server = useServerAttention()
    const catalogue = getCatalogue(server)
    const settings = getSettings(server)
    if (!user?.user.userId || !attention || attention.state.userId !== user.user.userId) {
        return (
            <DevPageShell title="Attention">
                <p>Sign in to inspect the current account.</p>
            </DevPageShell>
        )
    }
    const homeState = { ...attention.state, route: 'home' as const }
    const decision = decide(homeState, attention.asks, attention.ledger, {
        ...attention.session,
        route: 'home',
        openInterrupt: null,
        busy: false,
        gateUp: false,
    })
    const reason = (id: (typeof catalogue)[number]['id']) => {
        const surface =
            decision.interrupt === id
                ? 'interrupt'
                : decision.zone?.id === id
                  ? 'Home card'
                  : decision.inline?.id === id
                    ? 'inline notice'
                    : decision.banner === id
                      ? 'banner'
                      : null
        if (surface) {
            const row = catalogue.find((entry) => entry.id === id)!
            return `Selected ${surface} at tier ${row.tier}, rank ${row.rank}.${decision.zone?.id === id && decision.zone.underlay ? ` Replaces ${decision.zone.underlay}.` : ''}`
        }
        const explicit = decision.trace.reasons[id]
        if (explicit) return explicit
        const verdict = decision.trace.verdicts[id]
        if (!verdict || verdict === 'unknown') return 'Waiting for facts; device-only facts may be unknown.'
        if (verdict !== 'show') return verdict
        const ask = attention.asks.find((entry) => entry.id === id)
        if (ask && isSilenced(ask, attention.ledger[id], homeState)) return 'Snoozed or dismissed for this version.'
        if (attention.session.crashed?.includes(id)) return 'Surface unavailable for this session.'
        return decision.trace.candidates.includes(id) ? 'Eligible' : 'Not selected'
    }
    return (
        <DevPageShell title="Attention" description="Policy and decision for the signed-in account on this device.">
            <section>
                <h2>Home decision preview</h2>
                <p>Interrupt: {decision.interrupt ?? 'none'}</p>
                <p>Home: {decision.zone?.id ?? 'none'}</p>
                <p>Inline: {decision.inline?.id ?? 'none'}</p>
                <p>Banner: {decision.banner ?? 'none'}</p>
                <p>Device-only facts may be unknown while they load.</p>
            </section>
            <section>
                <h2>Decision inputs</h2>
                <dl>
                    <div>
                        <dt>Activated</dt>
                        <dd>
                            {attention.state.activated === undefined
                                ? 'unknown'
                                : attention.state.activated
                                  ? 'yes'
                                  : 'no'}
                        </dd>
                    </div>
                    <div>
                        <dt>Checklist step</dt>
                        <dd>{attention.state.onboarding?.step ?? 'unknown'}</dd>
                    </div>
                    <div>
                        <dt>Terms status</dt>
                        <dd>{attention.state.consent?.status ?? 'unknown'}</dd>
                    </div>
                    <div>
                        <dt>Full spend history</dt>
                        <dd>{attention.state.spendHistoryAvailable ? 'available' : 'unavailable'}</dd>
                    </div>
                    <div>
                        <dt>QR payment available</dt>
                        <dd>
                            {attention.state.qr?.canPayNow === undefined
                                ? 'unknown'
                                : attention.state.qr.canPayNow
                                  ? 'yes'
                                  : 'no'}
                        </dd>
                    </div>
                    <div>
                        <dt>Card payment available</dt>
                        <dd>
                            {attention.state.cardOffer?.canSpendViaCard === undefined
                                ? 'unknown'
                                : attention.state.cardOffer.canSpendViaCard
                                  ? 'yes'
                                  : 'no'}
                        </dd>
                    </div>
                </dl>
            </section>
            <section>
                <h2>Shared settings</h2>
                <dl>
                    {Object.entries(settings).map(([key, value]) => (
                        <div key={key}>
                            <dt>{key}</dt>
                            <dd>{value}</dd>
                        </div>
                    ))}
                </dl>
            </section>
            <section className="overflow-x-auto">
                <h2>Catalogue and reasons</h2>
                <p>
                    {server?.catalogueVersion === 1 && server.catalogue
                        ? 'Live backend catalogue'
                        : 'Generated fallback (live catalogue unavailable/unsupported)'}
                </p>
                <table className="w-full min-w-[90rem] border-collapse text-left text-sm [&_td]:border-b [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_th]:border-b [&_th]:px-3 [&_th]:py-3 [&_th]:align-top [&_th]:whitespace-nowrap">
                    <thead>
                        <tr>
                            <th>Ask</th>
                            <th>Tier</th>
                            <th>Rank</th>
                            <th>Surfaces</th>
                            <th>Interrupt routes</th>
                            <th>Budget</th>
                            <th>Snooze days</th>
                            <th>Expiry days</th>
                            <th>Session limits</th>
                            <th>Home policy</th>
                            <th>Email mapping</th>
                            <th>Verdict</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {catalogue.map((row) => (
                            <tr key={row.id}>
                                <td>{row.id}</td>
                                <td>{row.tier}</td>
                                <td>{row.rank}</td>
                                <td>{row.surfaces.join(', ')}</td>
                                <td>{row.surfaces.includes('interrupt') ? (row.policy.routes ?? 'home') : '—'}</td>
                                <td>{row.policy.interrupt}</td>
                                <td>{row.policy.snoozeDays ?? settings.defaultSnoozeDays}</td>
                                <td>{row.policy.expiryDays ?? 'No automatic expiry'}</td>
                                <td>
                                    min{' '}
                                    {row.policy.minSessions ??
                                        (row.policy.interrupt === 'quiet' ? settings.quietSessionMinCount : 0)}
                                    ; consecutive{' '}
                                    {row.tier >= 3
                                        ? (row.policy.maxConsecutiveSessions ?? settings.maxConsecutiveSessions)
                                        : 'unlimited'}
                                </td>
                                <td>
                                    anchor {row.policy.anchorsHome ? 'yes' : 'no'}; over anchor{' '}
                                    {row.policy.overAnchor ? 'yes' : 'no'}
                                </td>
                                <td>
                                    {row.emailMappings
                                        .map(
                                            (mapping) => `${mapping.prefix}${mapping.when ? ` (${mapping.when})` : ''}`
                                        )
                                        .join(', ') || 'none'}
                                </td>
                                <td>{decision.trace.verdicts[row.id] ?? 'unknown'}</td>
                                <td>{reason(row.id)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </DevPageShell>
    )
}
