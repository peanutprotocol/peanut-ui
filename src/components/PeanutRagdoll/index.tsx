'use client'

import { useEffect, useRef } from 'react'
import { startRagdoll } from './ragdoll'

// Fullscreen canvas + ragdoll engine. Drag any body part. Press R to reset.
// All state lives inside startRagdoll(); on unmount the cleanup function tears
// down listeners and the RAF loop, so closing the modal returns the page to
// a clean state.
export default function PeanutRagdoll() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        if (!canvasRef.current) return
        return startRagdoll(canvasRef.current)
    }, [])

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-primary-3">
            <canvas
                ref={canvasRef}
                className="block h-full w-full cursor-grab touch-none [&.dragging]:cursor-grabbing"
            />
            <div className="pointer-events-none absolute bottom-3 left-3 text-xs text-black opacity-60">
                drag the peanut · tap R to reset
            </div>
        </div>
    )
}
