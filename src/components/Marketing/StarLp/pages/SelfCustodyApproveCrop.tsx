'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import sendCrop from '@/assets/star-lp/self-custody-tile-send.webp'
import { SelfCustodyPulsingGlyph } from './SelfCustodyPulsingGlyph'
import type { SelfCustodyApproveCropProps } from './selfCustody.types'

// After the tile's PopIn (third in the stagger) has landed.
const PULSE_AFTER_MS = 800

/**
 * The send screen's recipient and amount (fixture `send`), with the passkey
 * mark in the corner. The mark pulses once when the tile comes into view: the
 * passkey is what approves this send. Still under reduced motion.
 */
export function SelfCustodyApproveCrop({ className }: SelfCustodyApproveCropProps) {
    const [pulse, setPulse] = useState(0)
    const timer = useRef<ReturnType<typeof setTimeout>>()
    useEffect(() => () => clearTimeout(timer.current), [])
    return (
        <motion.div
            className={className}
            viewport={{ once: true, amount: 0.6 }}
            onViewportEnter={() => {
                timer.current = setTimeout(() => setPulse(1), PULSE_AFTER_MS)
            }}
        >
            <Image
                src={sendCrop}
                alt=""
                sizes="(min-width: 1024px) 220px, (min-width: 768px) 300px, 45vw"
                className="h-auto max-h-full w-auto max-w-full"
            />
            <span className="absolute right-1 bottom-1 grid h-8 w-8 place-items-center rounded-full border border-border-default bg-background-disabled lg:h-9 lg:w-9">
                <SelfCustodyPulsingGlyph pulse={pulse} className="h-5 w-5" />
            </span>
        </motion.div>
    )
}
