'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { JOURNEY_API_BASE } from './journeyData'
import { inspectParam } from './userLookup'
import type { JourneyInspectResponse } from './journeyTypes'

/**
 * Live user lookup: which lifecycle nudge is due for this user right now, and
 * what have they already received (GET /__dev/journey-inspect).
 *
 * Takes a username or a raw userId — nobody remembers uuids, and the support
 * thread you came from only ever names the user by handle.
 */
export default function UserInspector() {
    const [term, setTerm] = useState('')
    const [result, setResult] = useState<JourneyInspectResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const inspect = async () => {
        const lookup = term.trim()
        if (!lookup) return
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const query = `${inspectParam(lookup)}=${encodeURIComponent(lookup)}`
            const res = await fetch(`${JOURNEY_API_BASE}/__dev/journey-inspect?${query}`)
            if (res.status === 404) {
                setError(`No user matches “${lookup}”. Check the spelling, or paste the raw userId.`)
                return
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            setResult((await res.json()) as JourneyInspectResponse)
        } catch {
            setError('Inspect unavailable — is the sandbox API running with PR #1234 code (DEV_EMAIL_PREVIEW=true)?')
        } finally {
            setLoading(false)
        }
    }

    const dueLabel = (() => {
        if (!result) return null
        if (!result.due) return 'none due (graduated, not in audience, or up to date)'
        if (result.due.skip === 'holdout') return `${result.due.type} — HELD (holdout control group)`
        if (result.due.skip === 'governor') return `${result.due.type} — HELD (governor: too soon after last email)`
        if (result.due.skip === 'balance')
            return `${result.due.type} — HELD (balance gate: live balance contradicts the copy)`
        return `${result.due.type} — due now${result.due.hasPendingRewards ? ' (rewards variant)' : ''}`
    })()

    return (
        <div className="flex max-w-2xl flex-col gap-3">
            <div className="flex gap-2">
                <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') void inspect()
                    }}
                    placeholder="username or userId"
                    className="h-10 flex-1 rounded-sm border border-border-default px-3 font-mono text-body-s outline-none"
                />
                <Button variant="purple" shadowSize="4" className="w-auto px-6" onClick={() => void inspect()}>
                    {loading ? 'Looking…' : 'Inspect'}
                </Button>
            </div>

            {error && (
                <div className="rounded-sm border border-border-default bg-action-secondary/40 p-3 text-body-s">
                    {error}
                </div>
            )}

            {result && (
                <div className="rounded-sm border border-border-default bg-white p-3">
                    <div className="text-label-l">
                        {result.user.username ?? '(no username)'}{' '}
                        <span className="font-normal text-foreground-secondary">
                            {result.user.email ?? '(no email)'}
                        </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-foreground-secondary">
                        resolved {result.user.username ? `@${result.user.username}` : '(no username)'} →{' '}
                        {result.user.userId}
                    </p>
                    <p className="mt-0.5 text-body-xs text-foreground-secondary">
                        signed up {new Date(result.user.createdAt).toLocaleDateString()} · card access{' '}
                        {result.user.cardAccessGrantedAt
                            ? new Date(result.user.cardAccessGrantedAt).toLocaleDateString()
                            : 'not granted'}
                    </p>
                    <p className="mt-2 text-body-s">
                        <span className="font-bold">Current nudge:</span>{' '}
                        <span className="rounded-sm bg-purple-200 px-1.5 py-0.5 font-mono text-body-xs">
                            {dueLabel}
                        </span>
                    </p>

                    <div className="mt-3">
                        <div className="text-label-m tracking-wide text-foreground-secondary uppercase">
                            Lifecycle email history
                        </div>
                        {result.history.length === 0 ? (
                            <p className="mt-1 text-body-s text-foreground-secondary">Nothing sent or attempted yet.</p>
                        ) : (
                            <div className="mt-1 overflow-x-auto">
                                <table className="w-full text-left text-body-xs">
                                    <thead>
                                        <tr className="border-b border-border-default text-foreground-secondary">
                                            <th className="py-1 pr-3 font-bold">event</th>
                                            <th className="py-1 pr-3 font-bold">channel</th>
                                            <th className="py-1 pr-3 font-bold">status</th>
                                            <th className="py-1 pr-3 font-bold">skip</th>
                                            <th className="py-1 font-bold">sent</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.history.map((row, i) => (
                                            <tr key={i} className="border-b border-border-default/20">
                                                <td className="py-1 pr-3 font-mono">{row.eventType}</td>
                                                <td className="py-1 pr-3">{row.channel}</td>
                                                <td className="py-1 pr-3">{row.status}</td>
                                                <td className="py-1 pr-3">{row.skipReason ?? '—'}</td>
                                                <td className="py-1">
                                                    {row.sentAt ? new Date(row.sentAt).toLocaleString() : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
