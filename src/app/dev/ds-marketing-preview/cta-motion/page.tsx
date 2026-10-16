'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'

/**
 * The marketing CTA motion layer (ruled 2026-10-16, konrad): the plain DS
 * Button plus CTA_MOTION. Hover a button for the drop-and-tilt; "Replay
 * entrance" remounts the pair so the mount entrance plays again. With
 * prefers-reduced-motion on, neither moves — only the DS press remains.
 */
export default function CtaMotionPreview() {
    const [mount, setMount] = useState(0)

    return (
        <main className="bg-background-page">
            <section className="bg-background-brand px-4 py-16 text-center text-foreground-primary">
                <p className="font-roboto-flex-extrabold text-heading-s uppercase">On a band</p>
                <Button key={`band-${mount}`} variant="secondary" className={`mx-auto mt-6 w-fit ${CTA_MOTION}`}>
                    Get the app
                </Button>
            </section>
            <section className="px-4 py-16 text-center text-foreground-primary">
                <p className="font-roboto-flex-extrabold text-heading-s uppercase">On cream</p>
                <Button key={`cream-${mount}`} variant="primary" className={`mx-auto mt-6 w-fit ${CTA_MOTION}`}>
                    Get the app
                </Button>
                <button
                    type="button"
                    onClick={() => setMount((n) => n + 1)}
                    className="mt-10 text-body-s text-foreground-secondary underline"
                >
                    Replay entrance
                </button>
            </section>
        </main>
    )
}
