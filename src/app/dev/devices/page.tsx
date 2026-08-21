'use client'

/**
 * /dev/devices - viewport harness, Milestone 1
 *
 * note: NOT /__devices — next.js treats _-prefixed app folders as private
 * (excluded from routing), so that path can never resolve.
 *
 * Chrome is deliberately colorless. Any accent here would contaminate your
 * judgment of the app inside the panes. One signal color only: overflow red.
 */

import { notFound } from 'next/navigation'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Presets. Replace with real p1/p50/p95 from PostHog once that query lands.
// ---------------------------------------------------------------------------
const PANES = [
    { id: 'se1', label: 'SE 1st / Larger Text', w: 320, h: 568 },
    { id: 'a-series', label: 'Galaxy A / budget', w: 360, h: 800 },
    { id: 'se3', label: 'iPhone SE 2/3', w: 375, h: 667 },
    { id: 'ip16', label: 'iPhone 15/16', w: 393, h: 852 },
    { id: 'pixel8', label: 'Pixel 7/8', w: 412, h: 915 },
    { id: 'promax', label: 'iPhone Pro Max', w: 430, h: 932 },
] as const

const GAP = 16
const CHROME_H = 132

type Measured = { px: number | null; pct: number | null }

export default function DevicesPage() {
    // gate lives outside the component that calls hooks, or rules-of-hooks fails lint.
    // notFound() gives a real 404 in prod instead of a blank page.
    if (process.env.NODE_ENV !== 'development') notFound()
    return <Harness />
}

function Harness() {
    const [pathInput, setPathInput] = useState('/')
    const [oneToOne, setOneToOne] = useState(false)
    const [box, setBox] = useState({ w: 1440, h: 900 })
    const [measured, setMeasured] = useState<Record<string, Measured>>({})
    const [hoverSel, setHoverSel] = useState<string | null>(null)
    const [logs, setLogs] = useState<{ pane: string; text: string; at: number }[]>([])
    const [overflow, setOverflow] = useState<Record<string, number>>({})
    // per-pane remount state for the liveness watchdog: bumping key remounts
    // the iframe, src points it back at the current route
    const [boot, setBoot] = useState<Record<string, { key: number; src: string }>>({})
    const bcRef = useRef<BroadcastChannel | null>(null)
    const lastSeen = useRef<Record<string, number>>({})
    const routeRef = useRef('/')

    // ---- channel ----------------------------------------------------------
    useEffect(() => {
        const bc = new BroadcastChannel('devsync')
        bcRef.current = bc
        bc.onmessage = (e) => {
            const m = e.data
            const id = m.pane ?? m.from
            if (id) lastSeen.current[id] = Date.now()
            if (m.t === 'measured') {
                setMeasured((prev) => ({ ...prev, [m.pane]: { px: m.px, pct: m.pct } }))
            } else if (m.t === 'hover') {
                setHoverSel(m.sel)
            } else if (m.t === 'route') {
                // panes navigate themselves (click in one pane mirrors to all);
                // reflect wherever they went in the path bar.
                setPathInput(m.path)
                routeRef.current = m.path
            } else if (m.t === 'log') {
                setLogs((prev) => [{ pane: m.pane, text: m.text, at: Date.now() }, ...prev].slice(0, 60))
            } else if (m.t === 'overflow') {
                setOverflow((prev) => ({ ...prev, [m.pane]: m.hits.length }))
            }
        }
        return () => bc.close()
    }, [])

    const post = useCallback((msg: unknown) => bcRef.current?.postMessage(msg), [])

    // ---- liveness watchdog -------------------------------------------------
    // A pane showing "refused to connect" is a browser error page with no agent
    // in it, so it can never recover on its own. Agents heartbeat every 3s;
    // any pane silent for >10s gets its iframe remounted at the current route.
    useEffect(() => {
        const now = Date.now()
        for (const p of PANES) lastSeen.current[p.id] = now
        // timers throttle in background tabs - a stale check on refocus would
        // mass-remount healthy panes, so reset instead
        const onVisible = () => {
            if (!document.hidden) for (const p of PANES) lastSeen.current[p.id] = Date.now()
        }
        document.addEventListener('visibilitychange', onVisible)
        const iv = window.setInterval(() => {
            if (document.hidden) return
            const t = Date.now()
            for (const p of PANES) {
                if (t - (lastSeen.current[p.id] ?? 0) > 10_000) {
                    lastSeen.current[p.id] = t // grace period while it boots
                    setBoot((prev) => ({
                        ...prev,
                        [p.id]: { key: (prev[p.id]?.key ?? 0) + 1, src: routeRef.current },
                    }))
                }
            }
        }, 4000)
        return () => {
            window.clearInterval(iv)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [])

    // ---- sizing -----------------------------------------------------------
    useEffect(() => {
        const onResize = () => setBox({ w: window.innerWidth, h: window.innerHeight })
        onResize()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    /**
     * ONE global scale factor. Non-negotiable.
     * Per-pane scaling silently invalidates every cross-pane size comparison,
     * which is the entire reason this tool exists.
     */
    const scale = useMemo(() => {
        if (oneToOne) return 1
        const sumW = PANES.reduce((a, p) => a + p.w, 0) + GAP * (PANES.length - 1)
        const maxH = Math.max(...PANES.map((p) => p.h))
        return Math.min(1, (box.w - 48) / sumW, (box.h - CHROME_H - 48) / maxH)
    }, [box, oneToOne])

    // ---- shortcuts --------------------------------------------------------
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.tagName === 'INPUT') return
            if (e.key === '1') setOneToOne((v) => !v)
            if (e.key === 'o') post({ t: 'scan' })
            if (e.key === 'Escape') {
                post({ t: 'clear' })
                setMeasured({})
                setHoverSel(null)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [post])

    // navigate via the channel only. also setting iframe src would double-load
    // every pane (src change reloads, then the agent's location.href reloads again).
    const go = () => {
        const p = pathInput.startsWith('/') ? pathInput : `/${pathInput}`
        routeRef.current = p
        post({ t: 'navigate', path: p })
    }

    const totalOverflow = Object.values(overflow).reduce((a, b) => a + b, 0)

    return (
        <div style={S.root}>
            <header style={S.bar}>
                <span style={S.brand}>viewport harness</span>

                <input
                    style={S.input}
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && go()}
                    spellCheck={false}
                    aria-label="Path"
                />
                <button style={S.btn} onClick={go}>
                    Go
                </button>

                <span style={S.sep} />

                <button style={S.btn} onClick={() => setOneToOne((v) => !v)}>
                    {oneToOne ? 'Fit' : '1:1'} <kbd style={S.kbd}>1</kbd>
                </button>
                <button style={S.btn} onClick={() => post({ t: 'scan' })}>
                    Scan overflow <kbd style={S.kbd}>o</kbd>
                </button>
                <span style={{ ...S.meta, color: totalOverflow ? SIGNAL : MUTED }}>
                    {totalOverflow ? `${totalOverflow} overflowing` : 'no overflow'}
                </span>

                <span style={S.sep} />
                <span style={S.meta}>scale {(scale * 100).toFixed(0)}%</span>
                <span style={S.meta} title={hoverSel ?? ''}>
                    {hoverSel ? truncate(hoverSel, 44) : 'hover an element to measure'}
                </span>
            </header>

            <div style={S.stage}>
                {PANES.map((p) => (
                    <Pane
                        key={p.id}
                        p={p}
                        scale={scale}
                        m={measured[p.id]}
                        hits={overflow[p.id] ?? 0}
                        boot={boot[p.id]}
                    />
                ))}
            </div>

            {logs.length > 0 && (
                <footer style={S.console}>
                    <div style={S.consoleHead}>
                        <span>errors</span>
                        <button style={S.btnGhost} onClick={() => setLogs([])}>
                            Clear
                        </button>
                    </div>
                    {logs.map((l, i) => (
                        <div key={i} style={S.logRow}>
                            <span style={S.logPane}>{l.pane}</span>
                            <span style={S.logText}>{l.text}</span>
                        </div>
                    ))}
                </footer>
            )}
        </div>
    )
}

function Pane({
    p,
    scale,
    m,
    hits,
    boot,
}: {
    p: (typeof PANES)[number]
    scale: number
    m?: Measured
    hits: number
    boot?: { key: number; src: string }
}) {
    return (
        <div style={{ width: p.w * scale }}>
            <div style={S.paneHead}>
                <span style={S.paneLabel}>{p.label}</span>
                <span style={S.paneDims}>
                    {p.w}
                    <span style={{ color: FAINT }}>x</span>
                    {p.h}
                </span>
            </div>

            <div style={{ width: p.w * scale, height: p.h * scale, overflow: 'hidden' }}>
                <iframe
                    // key bump = watchdog remount after a dead load; src then
                    // points back at the route everyone else is on
                    key={boot?.key ?? 0}
                    // window.name is the pane identity. It survives every
                    // navigation, unlike a query param that nuqs would strip.
                    name={`pane:${p.id}`}
                    data-pane={p.id}
                    src={boot?.src ?? '/'}
                    // without an explicit allowlist, permissions-policy can block
                    // camera/mic inside iframes (KYC + Sumsub flows need them)
                    allow="camera; microphone; clipboard-read; clipboard-write; geolocation"
                    width={p.w}
                    height={p.h}
                    style={{
                        width: p.w,
                        height: p.h,
                        border: 'none',
                        background: '#fff',
                        transform: `scale(${scale})`,
                        transformOrigin: '0 0',
                    }}
                />
            </div>

            <div style={S.paneFoot}>
                {m ? (
                    m.px === null ? (
                        <span style={{ color: FAINT }}>n/a</span>
                    ) : (
                        <span>
                            {m.px}px <span style={{ color: FAINT }}>/</span> {m.pct}%
                        </span>
                    )
                ) : (
                    <span style={{ color: FAINT }}>-</span>
                )}
                {hits > 0 && <span style={{ color: SIGNAL }}>{hits} overflow</span>}
            </div>
        </div>
    )
}

const truncate = (s: string, n: number) => (s.length <= n ? s : `...${s.slice(-(n - 3))}`)

// ---------------------------------------------------------------------------
// Colorless chrome. The only hue in the whole file is SIGNAL, and it only
// renders when something is actually wrong.
// ---------------------------------------------------------------------------
const SIGNAL = '#e5484d'
const INK = '#1a1a1a'
const MUTED = '#6b6b6b'
const FAINT = '#a8a8a8'
const LINE = '#e0e0e0'
const MONO = 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace'

const S: Record<string, CSSProperties> = {
    root: {
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f2f2f2',
        color: INK,
        fontFamily: MONO,
        fontSize: 11,
    },
    bar: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 16px',
        height: 40,
        background: '#fff',
        borderBottom: `1px solid ${LINE}`,
        flexShrink: 0,
    },
    brand: {
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontSize: 10,
        color: MUTED,
        marginRight: 8,
    },
    input: {
        fontFamily: MONO,
        fontSize: 11,
        padding: '4px 8px',
        width: 220,
        border: `1px solid ${LINE}`,
        borderRadius: 3,
        background: '#fafafa',
        outlineColor: INK,
    },
    btn: {
        fontFamily: MONO,
        fontSize: 11,
        padding: '4px 9px',
        border: `1px solid ${LINE}`,
        borderRadius: 3,
        background: '#fff',
        cursor: 'pointer',
        color: INK,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
    },
    btnGhost: { fontFamily: MONO, fontSize: 10, border: 'none', background: 'none', color: MUTED, cursor: 'pointer' },
    kbd: { fontSize: 9, color: FAINT, border: `1px solid ${LINE}`, borderRadius: 2, padding: '0 3px' },
    sep: { width: 1, height: 18, background: LINE, margin: '0 4px' },
    meta: { color: MUTED, whiteSpace: 'nowrap' },
    stage: { flex: 1, display: 'flex', gap: GAP, padding: 24, overflow: 'auto', alignItems: 'flex-start' },
    paneHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 },
    paneLabel: { color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    paneDims: { color: INK, fontVariantNumeric: 'tabular-nums' },
    paneFoot: { display: 'flex', justifyContent: 'space-between', marginTop: 6, fontVariantNumeric: 'tabular-nums' },
    console: { maxHeight: 160, overflow: 'auto', background: '#fff', borderTop: `1px solid ${LINE}`, flexShrink: 0 },
    consoleHead: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 16px',
        color: MUTED,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        position: 'sticky',
        top: 0,
        background: '#fff',
        borderBottom: `1px solid ${LINE}`,
    },
    logRow: { display: 'flex', gap: 10, padding: '3px 16px', borderBottom: `1px solid #f5f5f5` },
    logPane: { color: FAINT, minWidth: 92, flexShrink: 0 },
    logText: { color: SIGNAL, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
}
