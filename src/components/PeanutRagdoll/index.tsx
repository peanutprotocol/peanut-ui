'use client'

import { useEffect, useRef } from 'react'
import { startRagdoll } from './ragdoll'

// Canvas + ragdoll engine. Sized to the wrapping div (so the modal panel —
// not the viewport — defines the play area). All state lives inside
// startRagdoll(); on unmount the cleanup function tears down listeners +
// ResizeObserver + RAF, so closing the modal leaves no leaks.
//
// --- Future placements (pending team buy-in) ---------------------------------
// The component is reusable wherever a peanut would soften the moment. Ideas:
//
//   • KYC "verifying" wait modal (KycVerificationInProgressModal.tsx).
//     Sumsub is fast for the 90%, but the manual-review tail is 1–3 days of
//     anxious checking. Swap the clock icon for an inline ragdoll above the
//     title — "We're verifying your identity" reads very differently when
//     there's a peanut to flop while you wait.
//
//   • 404 (not-found.tsx). Replace the static crying-peanut GIF with a
//     face-planted ragdoll. The page already has the perfect copy; the
//     ragdoll's natural tipping-over behaviour IS the joke.
//
//   • Activation celebration moments (ActivationCTAs.tsx). When a step
//     flips done (verify ✓, deposit ✓, card ✓, first outbound ✓), fire a
//     ~2s ragdoll-confetti burst — drop the peanut from the top, let it
//     bounce off the card, gone. One-shot, self-dismisses.
//
//   • Tier-up moment on /rewards (right here). When the user crosses
//     T0→T1 / T1→T2, auto-open this drawer and drop the new tier badge as
//     a physics body that lands on the peanut.
//
//   • Card activation. Peanut + card + a few coins (various currencies) all
//     in the same physics box — the unboxing.
//
//   • Peanut Jail / waitlist (JoinWaitlistPage.tsx). A peanut bumping the
//     bars beats a static "you're on the list" gif.
// -----------------------------------------------------------------------------
export default function PeanutRagdoll() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        if (!canvasRef.current) return
        return startRagdoll(canvasRef.current)
    }, [])

    return (
        <div className="relative h-full w-full overflow-hidden bg-purple-1">
            <canvas
                ref={canvasRef}
                className="block h-full w-full cursor-grab touch-none [&.dragging]:cursor-grabbing"
            />
        </div>
    )
}
