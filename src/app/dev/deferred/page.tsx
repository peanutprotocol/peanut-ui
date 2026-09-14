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
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 font-mono text-body-s">
            <h1 className="text-heading-card">deferred deep link — dev</h1>

            <section>
                <h2 className="font-bold">state</h2>
                <pre className="border border-border-default p-2 whitespace-pre-wrap">
                    {JSON.stringify(state, null, 2)}
                </pre>
                <div className="flex gap-2">
                    <button className="border border-border-default px-2 py-1" onClick={refresh}>
                        refresh
                    </button>
                    <button
                        className="border border-border-default px-2 py-1"
                        onClick={() => {
                            localStorage.removeItem(CONSUMED_KEY)
                            refresh()
                        }}
                    >
                        reset consumed flag
                    </button>
                </div>
            </section>

            <section>
                <h2 className="font-bold">web → store hand-off</h2>
                <button
                    className="border border-border-default px-2 py-1"
                    onClick={() => {
                        setPayload(buildDeferredPayload('/home'))
                        setCopied(false)
                    }}
                >
                    build payload from current context (dest=/home)
                </button>
                {payload && (
                    <pre className="border border-border-default p-2 break-all whitespace-pre-wrap">
                        payload: {payload}
                        {'\n\n'}play url: {playStoreUrlWithReferrer(payload)}
                        {'\n\n'}ios hand-off: {iosHandoffString(payload)}
                    </pre>
                )}
                {payload && (
                    <button
                        className="border border-border-default px-2 py-1"
                        onClick={async () => {
                            await copyIOSHandoff(payload)
                            setCopied(true)
                        }}
                    >
                        {copied ? 'copied ✓' : 'copy ios hand-off to clipboard'}
                    </button>
                )}
            </section>

            <section>
                <h2 className="font-bold">native: raw install referrer</h2>
                <button className="border border-border-default px-2 py-1" onClick={readReferrer}>
                    read raw referrer (android native only)
                </button>
                <pre className="border border-border-default p-2 break-all whitespace-pre-wrap">{rawReferrer}</pre>
            </section>

            <section>
                <h2 className="font-bold">simulate restore</h2>
                <textarea
                    className="w-full border border-border-default p-2"
                    rows={3}
                    placeholder="pnutdl=1&lang=es-419&invite=test&dest=%2Fhome — or a full hand-off url"
                    value={simulateInput}
                    onChange={(e) => setSimulateInput(e.target.value)}
                />
                <button className="border border-border-default px-2 py-1" onClick={simulate}>
                    parse + apply
                </button>
                {simulateResult && (
                    <pre className="border border-border-default p-2 break-all whitespace-pre-wrap">
                        {simulateResult}
                    </pre>
                )}
            </section>
        </div>
    )
}
