'use client'

/**
 * Dev page: every WebAuthn ceremony this app session requested, in order.
 *
 * Repro on-device (Android), then open this page: one row per passkey sheet our
 * code asked for, tagged with the call path that asked. If a link creation shows
 * three rows, the purposes name the three call sites. If it shows fewer rows than
 * sheets you actually saw, the surplus came from the native plugin or the OS.
 */

import { useCallback, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { clearCeremonyLog, getCeremonyLog, type CeremonyRecord } from '@/utils/webauthn-ceremony-telemetry'
import DevPageShell from '../_components/DevPageShell'

const formatMs = (ms: number | null | undefined) => (ms === null || ms === undefined ? '—' : `${ms} ms`)

export default function CeremonyLogPage() {
    const [records, setRecords] = useState<CeremonyRecord[]>([])
    const [copied, setCopied] = useState(false)

    const refresh = useCallback(() => setRecords(getCeremonyLog()), [])

    const copy = useCallback(async () => {
        await navigator.clipboard.writeText(JSON.stringify(getCeremonyLog(), null, 2))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [])

    const byFlow = records.reduce<Record<string, number>>((acc, record) => {
        const key = record.flow ?? 'no flow'
        acc[key] = (acc[key] ?? 0) + 1
        return acc
    }, {})

    return (
        <DevPageShell
            title="WebAuthn ceremony log"
            description="Every passkey sheet this app session requested, with the call path that requested it. Reproduce the flow, then hit Refresh."
            width="prose"
        >
            <div className="flex flex-wrap gap-2">
                <Button onClick={refresh}>Refresh</Button>
                <Button variant="stroke" onClick={copy}>
                    {copied ? 'Copied' : 'Copy JSON'}
                </Button>
                <Button
                    variant="stroke"
                    onClick={() => {
                        clearCeremonyLog()
                        refresh()
                    }}
                >
                    Clear
                </Button>
            </div>

            {records.length === 0 ? (
                <p className="text-sm text-grey-1">
                    Nothing recorded yet. Create a send link (or sign in), then come back and hit Refresh.
                </p>
            ) : (
                <>
                    <div className="rounded-sm border border-n-1 p-3 text-sm">
                        <div className="font-bold">{records.length} ceremonies this session</div>
                        {Object.entries(byFlow).map(([flow, count]) => (
                            <div key={flow}>
                                {flow}: {count}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2">
                        {records.map((record) => (
                            <div key={record.seq} className="rounded-sm border border-n-1 p-3 text-sm">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="font-bold">
                                        #{record.seq} {record.purpose}
                                        {record.overlapped && ' ⚠️'}
                                    </span>
                                    <span>{record.outcome === 'ok' ? '✅ ok' : `❌ ${record.errorName}`}</span>
                                </div>
                                <div className="text-grey-1">
                                    {record.kind} · flow {record.flow ?? '—'} · took {formatMs(record.durationMs)} · gap
                                    before {formatMs(record.gapMs)}
                                    {record.allowCredentials !== undefined &&
                                        ` · allowCredentials ${record.allowCredentials}`}
                                    {record.errorCode && ` · ${record.errorCode}`}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <p className="text-xs text-grey-1">
                ⚠️ marks a ceremony that overlapped another one — its purpose is a guess, not evidence. These are the
                ceremonies our JavaScript asked for. More sheets on screen than rows here means the extra prompts come
                from @capgo/capacitor-passkey or the OS credential manager, not from our call sites.
            </p>
        </DevPageShell>
    )
}
