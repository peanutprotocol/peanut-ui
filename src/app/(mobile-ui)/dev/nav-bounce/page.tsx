'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { isCapacitor } from '@/utils/capacitor'
import { vibrateHaptic } from '@/utils/haptics'
import DevPageShell from '../_components/DevPageShell'

/**
 * Bottom-nav bounce proposals (Notion 3d08…8942).
 *
 * Five copies of the nav pill bar, each with a different motion recipe, so the
 * feel can be compared on a real device before BottomNav itself changes. Every
 * variant stays a compositor transition on `transform` — the 2026-09-03 ruling
 * that killed the framer JS spring (route-commit stutter) still holds. The
 * bouncy variants use CSS `linear()` easing sampled from real spring physics:
 * a true multi-bounce spring that still runs entirely on the compositor.
 *
 * `linear()` needs iOS 17.2+ / Chrome 113+. The page shows a warning when the
 * WebView lacks it; shipping a spring variant needs a bezier fallback via
 * `@supports`.
 */

// analytic underdamped spring (SwiftUI-style response/damping), sampled into a
// css linear() easing. duration is where the envelope drops under ~0.2% of the
// travel, so the tail is invisible.
function springLinear(response: number, damping: number, points = 64): { easing: string; durationMs: number } {
    const w0 = (2 * Math.PI) / response
    const wd = w0 * Math.sqrt(1 - damping * damping)
    const durationS = 6.2 / (damping * w0)
    const values: string[] = []
    for (let i = 0; i <= points; i++) {
        const t = (i / points) * durationS
        const decay = Math.exp(-damping * w0 * t)
        values.push((1 - decay * (Math.cos(wd * t) + ((damping * w0) / wd) * Math.sin(wd * t))).toFixed(4))
    }
    return { easing: `linear(${values.join(',')})`, durationMs: Math.round(durationS * 1000) }
}

const SPRING_NATIVE = springLinear(0.4, 0.7)
const SPRING_BOUNCY = springLinear(0.5, 0.55)
const SPRING_FULL = springLinear(0.45, 0.62)
// small-element return spring for the icon press-pop — very bouncy on purpose
const ICON_POP = springLinear(0.3, 0.45)

type Variant = {
    id: string
    title: string
    /** what to feel for, and what shipping it costs */
    note: string
    /** the exact css, so the winner can be lifted into BottomNav verbatim */
    spec: string
    durationMs: number
    easing: string
    /** icon squashes on finger-down and springs back on release */
    iconPop?: boolean
    /** haptic fires on pointerdown (native timing) instead of on click */
    hapticOnDown?: boolean
}

const VARIANTS: Variant[] = [
    {
        id: 'current',
        title: '0 · Current prod (baseline)',
        note: 'What ships today. One soft overshoot of a few percent, no second bounce.',
        spec: '250ms cubic-bezier(0.3, 1.06, 0.4, 1)',
        durationMs: 250,
        easing: 'cubic-bezier(0.3, 1.06, 0.4, 1)',
    },
    {
        id: 'token',
        title: 'A · DS ease-spring token',
        note: 'One-line diff: the existing --ease-spring token at 350ms. Bigger single overshoot (~10%), still no second bounce — a bezier cannot re-cross the target.',
        spec: '350ms cubic-bezier(0.34, 1.56, 0.64, 1) — token: ease-spring',
        durationMs: 350,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    {
        id: 'spring-native',
        title: 'B · True spring — snappy',
        note: 'Real spring physics via linear(). Fast arrival, one clear overshoot and a soft settle-back — closest to the SwiftUI default tab feel.',
        spec: `linear() spring — response 0.40s, damping 0.70 → ${SPRING_NATIVE.durationMs}ms`,
        durationMs: SPRING_NATIVE.durationMs,
        easing: SPRING_NATIVE.easing,
    },
    {
        id: 'spring-bouncy',
        title: 'C · True spring — bouncy',
        note: 'Lower damping: a visible double bounce before it rests, like SwiftUI .bouncy. The most playful; can read as loose if overdone.',
        spec: `linear() spring — response 0.50s, damping 0.55 → ${SPRING_BOUNCY.durationMs}ms`,
        durationMs: SPRING_BOUNCY.durationMs,
        easing: SPRING_BOUNCY.easing,
    },
    {
        id: 'full',
        title: 'D · Full native: spring + icon pop + haptic on touch-down',
        note: 'Mid spring, PLUS the tapped icon squashes under the finger and springs back on release, PLUS the haptic fires on finger-down (native timing) instead of on click. The layered iOS feel.',
        spec: `linear() spring — response 0.45s, damping 0.62 → ${SPRING_FULL.durationMs}ms; icon press scale 0.82 → spring back; haptic on pointerdown`,
        durationMs: SPRING_FULL.durationMs,
        easing: SPRING_FULL.easing,
        iconPop: true,
        hapticOnDown: true,
    },
]

type TabId = 'home' | 'middle' | 'support'
const TABS = [
    { id: 'home', icon: 'home' },
    { id: 'middle', icon: 'credit-card' },
    { id: 'support', icon: 'peanut-support' },
] as const

// same geometry as BottomNav: 68x52 pressables, pill 1px proud of its tab
function DemoBar({ variant }: { variant: Variant }) {
    const { triggerHaptic } = useAppHaptic()
    const [active, setActive] = useState<TabId>('home')
    const [pressed, setPressed] = useState<TabId | null>(null)
    const barRef = useRef<HTMLDivElement>(null)
    const tabRefs = useRef<Partial<Record<TabId, HTMLElement | null>>>({})
    const [boxes, setBoxes] = useState<Partial<Record<TabId, { left: number; width: number }>>>({})

    useLayoutEffect(() => {
        const measure = () => {
            const next: Partial<Record<TabId, { left: number; width: number }>> = {}
            for (const { id } of TABS) {
                const el = tabRefs.current[id]
                if (el) next[id] = { left: el.offsetLeft, width: el.offsetWidth }
            }
            setBoxes(next)
        }
        measure()
        const bar = barRef.current
        if (!bar || typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(bar)
        return () => observer.disconnect()
    }, [])

    const activeBox = boxes[active]

    return (
        <div
            ref={barRef}
            className="relative flex items-center justify-between rounded-round border border-border-default bg-background-page shadow-4"
        >
            {TABS.map(({ id, icon }) => (
                <button
                    key={id}
                    type="button"
                    aria-label={id}
                    ref={(el) => {
                        tabRefs.current[id] = el
                    }}
                    className="relative flex items-center justify-center rounded-round px-6 py-4 text-foreground-primary"
                    onPointerDown={() => {
                        if (variant.hapticOnDown) triggerHaptic()
                        if (variant.iconPop) setPressed(id)
                    }}
                    onPointerUp={() => setPressed(null)}
                    onPointerLeave={() => setPressed(null)}
                    onClick={() => {
                        if (!variant.hapticOnDown) triggerHaptic()
                        setActive(id)
                    }}
                >
                    <span
                        className="pointer-events-none relative z-10 inline-flex"
                        style={
                            variant.iconPop
                                ? {
                                      transform: pressed === id ? 'scale(0.82)' : 'scale(1)',
                                      transition:
                                          pressed === id
                                              ? 'transform 90ms ease-out'
                                              : `transform ${ICON_POP.durationMs}ms ${ICON_POP.easing}`,
                                  }
                                : undefined
                        }
                    >
                        <Icon name={icon} size={20} />
                    </span>
                </button>
            ))}
            {activeBox && (
                <span
                    aria-hidden
                    className="absolute -top-px -bottom-px left-0 z-0 rounded-round border border-border-default bg-background-default"
                    style={{
                        transform: `translateX(${activeBox.left - 1}px)`,
                        width: activeBox.width + 2,
                        transitionProperty: 'transform',
                        transitionDuration: `${variant.durationMs}ms`,
                        transitionTimingFunction: variant.easing,
                    }}
                />
            )}
        </div>
    )
}

// haptic recipes to evaluate separately from the motion — the winner pairs
// with any motion variant. native engine on capacitor, vibration api on web
// (iOS web has neither; the status card says which engine is live).
function fireHaptic(
    native: (h: typeof import('@capacitor/haptics')) => Promise<unknown>,
    webPattern: number | number[]
) {
    if (isCapacitor()) {
        import('@capacitor/haptics').then(native).catch(() => {})
        return
    }
    // vibrateHaptic routes web patterns through the Vibration API safely
    vibrateHaptic(webPattern)
}

const HAPTIC_RECIPES = [
    {
        label: 'Light impact (current prod)',
        run: () => fireHaptic(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }), 15),
    },
    {
        label: 'Medium impact',
        run: () => fireHaptic(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium }), 25),
    },
    {
        label: 'Selection tick (iOS picker feel)',
        run: () =>
            fireHaptic(
                ({ Haptics }) =>
                    Haptics.selectionStart()
                        .then(() => Haptics.selectionChanged())
                        .then(() => Haptics.selectionEnd()),
                10
            ),
    },
    {
        label: 'Tap + settle tick (light now, tick when the pill lands ~250ms later)',
        run: () => {
            fireHaptic(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }), 15)
            setTimeout(
                () =>
                    fireHaptic(
                        ({ Haptics }) =>
                            Haptics.selectionStart()
                                .then(() => Haptics.selectionChanged())
                                .then(() => Haptics.selectionEnd()),
                        10
                    ),
                250
            )
        },
    },
] as const

export default function DevNavBouncePage() {
    const [supportsLinear, setSupportsLinear] = useState(true)
    useEffect(() => {
        setSupportsLinear(typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)'))
    }, [])

    return (
        <DevPageShell
            title="Bottom-nav bounce"
            description="Five motion recipes for the nav pill, plus haptic recipes to pair with the winner. All compositor-only — no JS springs (2026-09-03 ruling). Tap the bars; test on a real device for haptics."
            width="prose"
        >
            <div className="space-y-6 flex flex-col">
                <Card className="space-y-1 p-4 text-body-s">
                    <div className="flex justify-between">
                        <span>Haptic engine:</span>
                        <span className="font-mono font-bold">
                            {isCapacitor()
                                ? 'native (@capacitor/haptics)'
                                : typeof navigator !== 'undefined' && 'vibrate' in navigator
                                  ? 'web Vibration API'
                                  : 'none — iOS web (use-haptic switch trick only)'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>CSS linear() easing:</span>
                        <span className="font-mono font-bold">
                            {supportsLinear ? 'supported' : 'NOT supported — B/C/D fall back to plain linear'}
                        </span>
                    </div>
                </Card>

                {VARIANTS.map((variant) => (
                    <Card key={variant.id} className="space-y-3 p-4">
                        <h2 className="text-heading-xs">{variant.title}</h2>
                        <DemoBar variant={variant} />
                        <p className="text-body-s text-foreground-secondary">{variant.note}</p>
                        <p className="font-mono text-body-xs text-foreground-secondary">{variant.spec}</p>
                    </Card>
                ))}

                <Card className="space-y-3 p-4">
                    <h2 className="text-heading-xs">Haptic recipes</h2>
                    <p className="text-body-s text-foreground-secondary">
                        Independent of the motion pick. Prod fires one light impact on click; these are the alternatives
                        worth feeling on device.
                    </p>
                    <div className="flex flex-col gap-2">
                        {HAPTIC_RECIPES.map((recipe) => (
                            <Button key={recipe.label} variant="primary-soft" shadowSize="4" onClick={recipe.run}>
                                {recipe.label}
                            </Button>
                        ))}
                    </div>
                </Card>

                <Card className="space-y-2 p-4 text-body-s">
                    <h3 className="font-bold">Shipping notes</h3>
                    <ul className="space-y-1 list-disc pl-4">
                        <li>A is a one-line change in BottomNav (duration + easing class).</li>
                        <li>
                            B/C/D need the sampled linear() string in css (a token in globals.css) plus a bezier
                            fallback under @supports for WebViews older than iOS 17.2 / Chrome 113.
                        </li>
                        <li>D also moves the haptic to pointerdown and adds the press-scale span around the icons.</li>
                        <li>
                            The drag-the-pill path is untouched by all variants — release re-uses whatever transition
                            ships.
                        </li>
                        <li>prefers-reduced-motion keeps the existing motion-safe guard in every variant.</li>
                    </ul>
                </Card>
            </div>
        </DevPageShell>
    )
}
