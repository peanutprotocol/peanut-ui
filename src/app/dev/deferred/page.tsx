'use client'

// dev tool for TASK-20772 deferred deep linking: inspect the hand-off state,
// build/copy payloads on web, read the raw android referrer, and simulate a
// restore from any raw string (the android dev loop — real referrer data only
// exists for play-delivered installs).
import { useCallback, useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import {
    applyDeferredPayload,
    buildDeferredPayload,
    copyIOSHandoff,
    iosHandoffString,
    parseDeferredPayload,
    playStoreUrlWithReferrer,
    readInstallReferrer,
    APP_LOCALE_KEY,
    CONSUMED_KEY,
} from '@/utils/deferred-link'
import { getFromCookie } from '@/utils/general.utils'
import { getPlatform, isCapacitor } from '@/utils/capacitor'
import { BASE_URL } from '@/constants/general.consts'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { Field } from '@/components/0_Bruddle/Field'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Section } from '@/components/0_Bruddle/Section'
import DevPageShell from '@/app/(mobile-ui)/dev/_components/DevPageShell'

export default function DeferredLinkDevPage() {
    const [state, setState] = useState<Record<string, string>>({})
    const [payload, setPayload] = useState('')
    const [rawReferrer, setRawReferrer] = useState('(not read)')
    const [simulateInput, setSimulateInput] = useState('')
    const [simulateResult, setSimulateResult] = useState('')
    const [copied, setCopied] = useState(false)

    const refresh = useCallback(() => {
        setState({
            platform: getPlatform(),
            consumedFlag: localStorage.getItem(CONSUMED_KEY) ?? '(unset)',
            persistedLocale: localStorage.getItem(APP_LOCALE_KEY) ?? '(unset)',
            inviteCodeCookie: String(getFromCookie('inviteCode') ?? '(unset)'),
            campaignTagCookie: String(getFromCookie('campaignTag') ?? '(unset)'),
        })
    }, [])

    useEffect(() => refresh(), [refresh])

    const readReferrer = async () => {
        setRawReferrer((await readInstallReferrer()) ?? '(null / unavailable)')
    }

    const simulate = () => {
        const parsed = parseDeferredPayload(simulateInput)
        if (!parsed) {
            setSimulateResult('rejected (no pnutdl marker)')
        } else {
            const { dest, locale } = applyDeferredPayload(parsed)
            setSimulateResult(
                `applied ${JSON.stringify(parsed)} → dest: ${dest ?? 'none'}, locale: ${locale ?? 'none'}`
            )
        }
        refresh()
    }

    // same wall as (mobile-ui)/dev/layout.tsx, with a native exception: the
    // capacitor build ships with BASE_URL=peanut.me but needs this page for
    // on-device verification. web prod stays blocked. (after hooks — throwing
    // before them would break the rules of hooks.)
    if (BASE_URL === 'https://peanut.me' && !isCapacitor()) notFound()

    return (
        <DevPageShell
            title="Deferred deep link"
            description="Inspect the hand-off state, build store payloads, and simulate a restore from a raw referrer."
            width="prose"
        >
            <Section title="State">
                <Card className="p-3">
                    <pre className="overflow-auto font-mono text-body-xs whitespace-pre-wrap">
                        {JSON.stringify(state, null, 2)}
                    </pre>
                </Card>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <Button variant="stroke" size="small" onClick={refresh}>
                        Refresh
                    </Button>
                    <Button
                        variant="stroke"
                        size="small"
                        onClick={() => {
                            localStorage.removeItem(CONSUMED_KEY)
                            refresh()
                        }}
                    >
                        Reset consumed flag
                    </Button>
                </div>
            </Section>

            <Section title="Web to store hand-off">
                <Button
                    variant="stroke"
                    onClick={() => {
                        setPayload(buildDeferredPayload('/home'))
                        setCopied(false)
                    }}
                >
                    Build payload for /home
                </Button>
                {payload && (
                    <Card className="p-3">
                        <pre className="overflow-auto font-mono text-body-xs break-all whitespace-pre-wrap">
                            payload: {payload}
                            {'\n\n'}play url: {playStoreUrlWithReferrer(payload)}
                            {'\n\n'}ios hand-off: {iosHandoffString(payload)}
                        </pre>
                    </Card>
                )}
                {payload && (
                    <Button
                        variant="stroke"
                        icon="copy"
                        onClick={async () => {
                            await copyIOSHandoff(payload)
                            setCopied(true)
                        }}
                    >
                        {copied ? 'Copied' : 'Copy iOS hand-off'}
                    </Button>
                )}
            </Section>

            <Section title="Native install referrer">
                <Button variant="stroke" onClick={readReferrer}>
                    Read raw Android referrer
                </Button>
                <Card className="p-3">
                    <pre className="overflow-auto font-mono text-body-xs break-all whitespace-pre-wrap">
                        {rawReferrer}
                    </pre>
                </Card>
            </Section>

            <Section title="Simulate restore">
                <Field label="Raw referrer or hand-off URL">
                    <BaseInput
                        placeholder="pnutdl=1&lang=es-419&invite=test&dest=%2Fhome — or a full hand-off url"
                        value={simulateInput}
                        onChange={(event) => setSimulateInput(event.target.value)}
                    />
                </Field>
                <Button onClick={simulate}>Parse and apply</Button>
                {simulateResult && (
                    <Callout priority={simulateResult.startsWith('rejected') ? 'error' : 'success'}>
                        <span className="font-mono break-all">{simulateResult}</span>
                    </Callout>
                )}
            </Section>
        </DevPageShell>
    )
}
