'use client'

import { useEffect, useRef } from 'react'
import { startRagdoll } from './ragdoll'

// Canvas + ragdoll engine. Sized to the wrapping div (so the modal panel —
// not the viewport — defines the play area). All state lives inside
// startRagdoll(); on unmount the cleanup function tears down listeners +
// ResizeObserver + RAF, so closing the modal leaves no leaks.
export default function PeanutRagdoll() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        if (!canvasRef.current) return
        return startRagdoll(canvasRef.current)
    }, [])

    return (
        <div className="relative h-full w-full overflow-hidden bg-primary-3">
            <canvas
                ref={canvasRef}
                className="block h-full w-full cursor-grab touch-none [&.dragging]:cursor-grabbing"
            />
            <div className="pointer-events-none absolute bottom-3 left-3 text-xs text-black opacity-60">
                drag the peanut
            </div>
        </div>
    )
}
