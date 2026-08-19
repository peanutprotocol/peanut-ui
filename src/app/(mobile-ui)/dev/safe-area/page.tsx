'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { getPlatform } from '@/utils/capacitor'

const EDGES = ['top', 'right', 'bottom', 'left'] as const
type Edge = (typeof EDGES)[number]
type Edges = Record<Edge, string>

/**
 * env() and custom properties can't be read from JS directly — mount a hidden probe
 * whose padding is the expression under test and read back the resolved computed value.
 */
function measure(expression: string): string {
    const probe = document.createElement('div')
    probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;padding-top:${expression}`
    document.body.appendChild(probe)
    const value = getComputedStyle(probe).paddingTop
    probe.remove()
    return value
}

function measureEdges(build: (edge: Edge) => string): Edges {
    return EDGES.reduce((acc, edge) => ({ ...acc, [edge]: measure(build(edge)) }), {} as Edges)
}

type Reading = {
    env: Edges
    variable: Edges
    injected: boolean
    injectedRaw: string
    platform: string
    webView: string
    dpr: number
    innerHeight: number
    visualViewportHeight: string
}

function read(): Reading {
    const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)
    return {
        env: measureEdges((edge) => `env(safe-area-inset-${edge}, 0px)`),
        variable: measureEdges((edge) => `var(--safe-${edge})`),
        // non-empty means Capacitor's SystemBars plugin actually wrote the inline style;
        // empty means we fell through to the env() seed in globals.css
        injected: document.documentElement.style.getPropertyValue('--safe-area-inset-top') !== '',
        injectedRaw: document.documentElement.style.getPropertyValue('--safe-area-inset-top') || '—',
        platform: getPlatform(),
        webView: chromeVersion ? chromeVersion[1] : '—',
        dpr: window.devicePixelRatio,
        innerHeight: window.innerHeight,
        visualViewportHeight: window.visualViewport ? `${Math.round(window.visualViewport.height)}px` : '—',
    }
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-n-1/10 py-1.5 last:border-b-0">
            <span className={`text-xs ${muted ? 'text-grey-1' : ''}`}>{label}</span>
            <span className="font-mono text-xs font-bold">{value}</span>
        </div>
    )
}

export default function DevSafeAreaPage() {
    const [reading, setReading] = useState<Reading | null>(null)

    const refresh = useCallback(() => setReading(read()), [])

    useEffect(() => {
        refresh()
        window.addEventListener('resize', refresh)
        window.addEventListener('orientationchange', refresh)
        window.visualViewport?.addEventListener('resize', refresh)
        return () => {
            window.removeEventListener('resize', refresh)
            window.removeEventListener('orientationchange', refresh)
            window.visualViewport?.removeEventListener('resize', refresh)
        }
    }, [refresh])

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="px-4 pt-4">
                <NavHeader title="Safe Area" />
            </div>

            <div className="space-y-4 flex h-full flex-col px-4 pb-8">
                <p className="text-sm text-grey-1">
                    What the app actually reserves for the status bar and system bars on this device. On Android 15+
                    Capacitor measures the insets natively — max(system bars, display cutout) — and overwrites the
                    variables; everywhere else they fall back to env(). A gap between the two columns is the bug.
                </p>

                <Button variant="stroke" size="small" onClick={refresh}>
                    Refresh
                </Button>

                {reading && (
                    <>
                        <Card className="p-4">
                            <h2 className="mb-2 text-sm font-bold">Insets</h2>
                            {EDGES.map((edge) => (
                                <Row
                                    key={edge}
                                    label={edge}
                                    value={`env ${reading.env[edge]}  →  var ${reading.variable[edge]}`}
                                />
                            ))}
                        </Card>

                        <Card className="p-4">
                            <h2 className="mb-2 text-sm font-bold">Source</h2>
                            <Row
                                label="natively injected"
                                value={reading.injected ? 'yes' : 'no (env fallback)'}
                                muted
                            />
                            <Row label="inline --safe-area-inset-top" value={reading.injectedRaw} muted />
                            <Row label="platform" value={reading.platform} muted />
                            <Row label="webview (Chrome)" value={reading.webView} muted />
                            <Row label="devicePixelRatio" value={String(reading.dpr)} muted />
                            <Row label="innerHeight" value={`${reading.innerHeight}px`} muted />
                            <Row label="visualViewport" value={reading.visualViewportHeight} muted />
                        </Card>

                        <Card className="p-4">
                            <h2 className="mb-2 text-sm font-bold">Top inset, drawn</h2>
                            <div className="space-y-2">
                                <div>
                                    <span className="text-xs text-grey-1">env()</span>
                                    <div
                                        className="w-full bg-primary-1"
                                        style={{ height: 'env(safe-area-inset-top)' }}
                                    />
                                </div>
                                <div>
                                    <span className="text-xs text-grey-1">var(--safe-top)</span>
                                    <div className="h-safe-top w-full bg-secondary-3" />
                                </div>
                            </div>
                        </Card>
                    </>
                )}
            </div>
        </div>
    )
}
