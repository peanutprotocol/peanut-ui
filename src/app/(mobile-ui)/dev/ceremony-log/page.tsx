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
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Callout } from '@/components/0_Bruddle/Callout'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
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
                <EmptyState
                    icon="clock"
                    title="No ceremonies recorded"
                    description="Create a send link or sign in, then refresh this log."
                />
            ) : (
                <>
                    <Card className="divide-y divide-dashed divide-border-default px-4">
                        <DataRow label="Ceremonies this session" value={records.length} />
                        {Object.entries(byFlow).map(([flow, count]) => (
                            <DataRow key={flow} label={flow} value={count} />
                        ))}
                    </Card>

                    <ListGroup>
                        {records.map((record) => (
                            <ListItem
                                key={record.seq}
                                title={`#${record.seq} ${record.purpose}`}
                                bodyWrap
                                body={
                                    <>
                                        {record.overlapped && <strong>Overlapped · </strong>}
                                        {record.kind} · flow {record.flow ?? '—'} · took {formatMs(record.durationMs)} ·
                                        gap before {formatMs(record.gapMs)}
                                        {record.allowCredentials !== undefined &&
                                            ` · allowCredentials ${record.allowCredentials}`}
                                        {record.errorCode && ` · ${record.errorCode}`}
                                    </>
                                }
                                trailing={record.outcome === 'ok' ? 'ok' : record.errorName}
                            />
                        ))}
                    </ListGroup>
                </>
            )}

            <Callout priority="attention" title="About overlapping ceremonies">
                An overlap label is a guess, not evidence. Extra sheets without log rows come from the native passkey
                plugin or the OS credential manager.
            </Callout>
        </DevPageShell>
    )
}
