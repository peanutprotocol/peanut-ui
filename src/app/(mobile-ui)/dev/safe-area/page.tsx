'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Section } from '@/components/0_Bruddle/Section'
import { getPlatform } from '@/utils/capacitor'
import DevPageShell from '../_components/DevPageShell'

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
    return <DataRow label={label} value={<span className={muted ? 'text-foreground-secondary' : ''}>{value}</span>} />
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
        <DevPageShell
            title="Safe area"
            description="What the app reserves for status and system bars. A gap between the env and variable values is the bug."
            width="prose"
        >
            <Button variant="stroke" size="small" onClick={refresh}>
                Refresh
            </Button>

            {reading && (
                <>
                    <Section title="Insets">
                        <Card className="divide-y divide-dashed divide-border-default px-4">
                            {EDGES.map((edge) => (
                                <Row
                                    key={edge}
                                    label={edge}
                                    value={`env ${reading.env[edge]}  →  var ${reading.variable[edge]}`}
                                />
                            ))}
                        </Card>
                    </Section>

                    <Section title="Source">
                        <Card className="divide-y divide-dashed divide-border-default px-4">
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
                    </Section>

                    <Section title="Top inset, drawn">
                        <Card className="p-4">
                            <div className="space-y-2">
                                <div>
                                    <span className="text-body-xs text-foreground-secondary">env()</span>
                                    <div
                                        className="w-full bg-action-primary"
                                        style={{ height: 'env(safe-area-inset-top)' }}
                                    />
                                </div>
                                <div>
                                    <span className="text-body-xs text-foreground-secondary">var(--safe-top)</span>
                                    <div className="h-safe-top w-full bg-background-icon-bubble-blue" />
                                </div>
                            </div>
                        </Card>
                    </Section>
                </>
            )}
        </DevPageShell>
    )
}
