'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { JOURNEY_API_BASE } from './journeyData'
import type { JourneyInspectResponse } from './journeyTypes'

/**
 * Live user lookup: which lifecycle nudge is due for this user right now, and
 * what have they already received (GET /__dev/journey-inspect?userId=…).
 */
export default function UserInspector() {
    const [userId, setUserId] = useState('')
    const [result, setResult] = useState<JourneyInspectResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const inspect = async () => {
        const id = userId.trim()
        if (!id) return
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const res = await fetch(`${JOURNEY_API_BASE}/__dev/journey-inspect?userId=${encodeURIComponent(id)}`)
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
        return `${result.due.type} — due now${result.due.hasPendingRewards ? ' (rewards variant)' : ''}`
    })()

    return (
        <div className="flex max-w-2xl flex-col gap-3">
            <div className="flex gap-2">
                <input
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') void inspect()
                    }}
                    placeholder="userId (uuid)"
                    className="h-10 flex-1 rounded-sm border border-n-1 px-3 font-mono text-sm outline-none"
                />
                <Button variant="purple" shadowSize="4" className="w-auto px-6" onClick={() => void inspect()}>
                    {loading ? 'Looking…' : 'Inspect'}
                </Button>
            </div>

            {error && <div className="rounded-sm border border-n-1 bg-yellow-1/40 p-3 text-sm">{error}</div>}

            {result && !result.user && (
                <div className="rounded-sm border border-n-1 bg-yellow-1/40 p-3 text-sm">User not found.</div>
            )}

            {result?.user && (
                <div className="rounded-sm border border-n-1 bg-white p-3">
                    <div className="text-sm font-bold">
                        {result.user.username ?? '(no username)'}{' '}
                        <span className="font-normal text-grey-1">{result.user.email ?? '(no email)'}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-grey-1">
                        signed up {new Date(result.user.createdAt).toLocaleDateString()} · card access{' '}
                        {result.user.cardAccessGrantedAt
                            ? new Date(result.user.cardAccessGrantedAt).toLocaleDateString()
                            : 'not granted'}
                    </p>
                    <p className="mt-2 text-sm">
                        <span className="font-bold">Current nudge:</span>{' '}
                        <span className="rounded-sm bg-primary-3 px-1.5 py-0.5 font-mono text-xs">{dueLabel}</span>
                    </p>

                    <div className="mt-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-grey-1">
                            Lifecycle email history
                        </div>
                        {result.history.length === 0 ? (
                            <p className="mt-1 text-sm text-grey-1">Nothing sent or attempted yet.</p>
                        ) : (
                            <div className="mt-1 overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-n-1 text-grey-1">
                                            <th className="py-1 pr-3 font-bold">event</th>
                                            <th className="py-1 pr-3 font-bold">channel</th>
                                            <th className="py-1 pr-3 font-bold">status</th>
                                            <th className="py-1 pr-3 font-bold">skip</th>
                                            <th className="py-1 font-bold">sent</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.history.map((row, i) => (
                                            <tr key={i} className="border-b border-n-1/20">
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
