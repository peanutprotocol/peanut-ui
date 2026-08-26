'use client'

import { useEffect, useRef } from 'react'
import { startRagdoll } from './ragdoll'

// Canvas + ragdoll engine. Sized to the wrapping div, so the host — not the
// viewport — defines the play area. All state lives inside startRagdoll(); on
// unmount the cleanup function tears down listeners + ResizeObserver + RAF, so
// leaving the screen leaves no leaks.
//
// Two things every host has to get right:
//   • Definite height. `h-full` below resolves to 0 against a `min-h-*` parent,
//     and the canvas then paints nothing while the loop keeps running.
//   • aria-hidden="true" on the host — the peanut is decoration, and this
//     component does not set it for you.
//
// Under prefers-reduced-motion the engine skips the drop and paints one settled
// frame instead of running the loop (see ragdoll.ts).
//
// Live placements: 404 (app/not-found.tsx), maintenance (app/maintenance/page.tsx),
// Peanut Jail (Invites/InvitesPageLayout.tsx — jail step only).
//
// Still open, pending team buy-in:
//   • KYC "verifying" wait modal (KycVerificationInProgressModal.tsx). The
//     manual-review tail is 1–3 days of anxious checking; a peanut to flop
//     while you wait beats a clock icon.
//   • Activation celebrations (ActivationCTAs.tsx). One-shot ~2s drop when a
//     step flips done, then gone.
//   • Card activation — peanut + card + coins in one physics box.
export default function PeanutRagdoll() {
    const hostRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (!canvasRef.current) return
        try {
            return startRagdoll(canvasRef.current)
        } catch (err) {
            // startRagdoll throws on a dead 2D context and nothing above this
            // is an error boundary. /maintenance is the page that has to work
            // when nothing else does, so lose the peanut, not the route.
            console.error('PeanutRagdoll failed to start', err)
            return
        }
    }, [])

    useEffect(() => {
        const host = hostRef.current
        if (!host) return
        // usePullToRefresh listens for touch on `document`. `touch-none` stops
        // scrolling but not JS touch events, so dragging the peanut downward on
        // any screen inside that hook would trigger a page reload. Swallow the
        // gesture before it leaves the play area.
        const stop = (e: TouchEvent) => e.stopPropagation()
        host.addEventListener('touchstart', stop)
        return () => host.removeEventListener('touchstart', stop)
    }, [])

    return (
        <div ref={hostRef} className="relative h-full w-full overflow-hidden bg-purple-1">
            <canvas
                ref={canvasRef}
                className="block h-full w-full cursor-grab touch-none [&.dragging]:cursor-grabbing"
            />
        </div>
    )
}
