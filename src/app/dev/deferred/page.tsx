'use client'

// dev tool for TASK-20772 deferred deep linking: inspect the hand-off state,
// build/copy payloads on web, read the raw android referrer, and simulate a
// restore from any raw string (the android dev loop — real referrer data only
// exists for play-delivered installs).
import { useCallback, useEffect, useState } from 'react'
import { registerPlugin } from '@capacitor/core'
import {
    applyDeferredPayload,
    buildDeferredPayload,
    copyIOSHandoff,
    iosHandoffString,
    parseDeferredPayload,
    playStoreUrlWithReferrer,
    CONSUMED_KEY,
} from '@/utils/deferred-link'
import { getFromCookie } from '@/utils/general.utils'
import { getPlatform } from '@/utils/capacitor'
import { useAppLocale } from '@/i18n/app/AppIntlProvider'

const InstallReferrer = registerPlugin<{ getReferrer(): Promise<{ referrer: string | null }> }>('InstallReferrer')

export default function DeferredLinkDevPage() {
    const { locale, setLocale } = useAppLocale()
    const [state, setState] = useState<Record<string, string>>({})
    const [payload, setPayload] = useState('')
    const [rawReferrer, setRawReferrer] = useState('(not read)')
    const [simulateInput, setSimulateInput] = useState('')
    const [simulateResult, setSimulateResult] = useState('')
    const [copied, setCopied] = useState(false)

    const refresh = useCallback(() => {
        setState({
            platform: getPlatform(),
            appLocale: locale,
            consumedFlag: localStorage.getItem(CONSUMED_KEY) ?? '(unset)',
            inviteCodeCookie: String(getFromCookie('inviteCode') ?? '(unset)'),
            campaignTagCookie: String(getFromCookie('campaignTag') ?? '(unset)'),
        })
    }, [locale])

    useEffect(() => refresh(), [refresh])

    const readReferrer = async () => {
        try {
            const { referrer } = await InstallReferrer.getReferrer()
            setRawReferrer(referrer ?? '(null)')
        } catch (e) {
            setRawReferrer(`unavailable: ${e instanceof Error ? e.message : String(e)}`)
        }
    }

    const simulate = async () => {
        const parsed = parseDeferredPayload(simulateInput)
        if (!parsed) {
            setSimulateResult('rejected (no pnutdl marker)')
        } else {
            const { dest, locale: restoredLocale } = applyDeferredPayload(parsed)
            if (restoredLocale) await setLocale(restoredLocale)
            setSimulateResult(
                `applied ${JSON.stringify(parsed)} → dest: ${dest ?? 'none'}, locale: ${restoredLocale ?? 'none'}`
            )
        }
        refresh()
    }

    return (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 font-mono text-sm">
            <h1 className="text-lg font-bold">deferred deep link — dev</h1>

            <section>
                <h2 className="font-bold">state</h2>
                <pre className="whitespace-pre-wrap border border-n-1 p-2">{JSON.stringify(state, null, 2)}</pre>
                <div className="flex gap-2">
                    <button className="border border-n-1 px-2 py-1" onClick={refresh}>
                        refresh
                    </button>
                    <button
                        className="border border-n-1 px-2 py-1"
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
                    className="border border-n-1 px-2 py-1"
                    onClick={() => setPayload(buildDeferredPayload('/home'))}
                >
                    build payload from current context (dest=/home)
                </button>
                {payload && (
                    <pre className="whitespace-pre-wrap break-all border border-n-1 p-2">
                        payload: {payload}
                        {'\n\n'}play url: {playStoreUrlWithReferrer(payload)}
                        {'\n\n'}ios hand-off: {iosHandoffString(payload)}
                    </pre>
                )}
                {payload && (
                    <button
                        className="border border-n-1 px-2 py-1"
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
                <button className="border border-n-1 px-2 py-1" onClick={readReferrer}>
                    read raw referrer (android native only)
                </button>
                <pre className="whitespace-pre-wrap break-all border border-n-1 p-2">{rawReferrer}</pre>
            </section>

            <section>
                <h2 className="font-bold">simulate restore</h2>
                <textarea
                    className="w-full border border-n-1 p-2"
                    rows={3}
                    placeholder="pnutdl=1&lang=es-419&invite=test&dest=%2Fhome — or a full hand-off url"
                    value={simulateInput}
                    onChange={(e) => setSimulateInput(e.target.value)}
                />
                <button className="border border-n-1 px-2 py-1" onClick={simulate}>
                    parse + apply
                </button>
                {simulateResult && (
                    <pre className="whitespace-pre-wrap break-all border border-n-1 p-2">{simulateResult}</pre>
                )}
            </section>
        </div>
    )
}
