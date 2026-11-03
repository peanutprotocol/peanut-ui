'use client'

import { Component, Suspense, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { recoverFromChunkError } from '@/utils/chunk-error-recovery'
import { AttentionSurfaceContext, isManagerOverlayOpen } from '@/utils/overlay-visibility'
import { useAttentionOptional, type AttentionContextValue } from './AttentionProvider'
import { INTERRUPT_SURFACES } from './surfaces'
import type { AskId } from './types'

/**
 * The one place an interrupt renders. Mounted once in the mobile layout; it
 * shows the surface for `decision.interrupt` and nothing else. The surface
 * gets three callbacks and no gating of its own.
 *
 * A pick that changes from A to B unmounts A at once, without an exit
 * animation: a closing vaul portal would otherwise keep its overlay and
 * focus lock over B while B opens.
 */
export function AttentionInterrupt() {
    const attention = useAttentionOptional()
    // the manager crashed and its boundary renders the app without it: no pop-up, and no second throw
    return attention ? <InterruptHost attention={attention} /> : null
}

function InterruptHost({ attention }: { attention: AttentionContextValue }) {
    const { decision, state, asks, opened, crashed, acted, action, dismissed, snoozed } = attention
    const id = decision.interrupt
    const Surface = id ? INTERRUPT_SURFACES[id] : undefined

    const warnedFor = useRef<AskId | null>(null)
    useEffect(() => {
        if (!id || Surface || warnedFor.current === id) return
        warnedFor.current = id
        Sentry.captureMessage(`attention: no interrupt surface registered for ${id}`, {
            level: 'error',
            tags: { feature: 'attention' },
        })
    }, [id, Surface])

    useEffect(() => {
        if (id && Surface) opened(id)
    }, [id, Surface, opened])

    if (!id || !Surface) return null
    return (
        <AttentionSurfaceContext.Provider value={true}>
            {/* keyed by user too: a surface never carries the previous account's state */}
            <SurfaceBoundary key={`${state.userId}:${id}`} askId={id} onCrash={() => crashed(id)}>
                <Suspense fallback={null}>
                    <Surface
                        presentation={asks.find((ask) => ask.id === id)?.presentation ?? 'modal'}
                        askId={id}
                        onActed={() => acted(id)}
                        onAction={(properties) => action(id, properties)}
                        onDismissed={() => dismissed(id)}
                        onSnoozed={(until) => snoozed(id, until)}
                    />
                    <ShowDeadline askId={id} onMissed={() => crashed(id)} />
                </Suspense>
            </SurfaceBoundary>
        </AttentionSurfaceContext.Provider>
    )
}

/** How long a surface whose code has loaded may take to put its modal or drawer on screen. */
export const SURFACE_SHOW_DEADLINE_MS = 10_000

/**
 * Some surfaces still check their own conditions. When that check and the
 * verdict disagree, the pick shows nothing and would hold the interrupt slot
 * for the session; past the deadline it is skipped for this load and reported.
 * Mounted beside the surface inside Suspense, so the clock starts once its code
 * has loaded.
 */
function ShowDeadline({ askId, onMissed }: { askId: AskId; onMissed: () => void }) {
    const missed = useRef(onMissed)
    missed.current = onMissed
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isManagerOverlayOpen()) return
            Sentry.captureMessage(`attention: ${askId} was picked but showed nothing`, {
                level: 'warning',
                tags: { feature: 'attention', ask: askId },
            })
            missed.current()
        }, SURFACE_SHOW_DEADLINE_MS)
        return () => clearTimeout(timer)
    }, [askId])
    return null
}

/** A surface that throws is skipped for this load (never recorded as an answer), so it cannot re-mount in a loop. */
export class SurfaceBoundary extends Component<
    { askId: AskId; onCrash: () => void; children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false }
    static getDerivedStateFromError() {
        return { failed: true }
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        recoverFromChunkError(error)
        Sentry.captureException(error, {
            tags: { feature: 'attention', ask: this.props.askId },
            extra: { componentStack: info.componentStack },
        })
        this.props.onCrash()
    }
    render() {
        return this.state.failed ? null : this.props.children
    }
}
