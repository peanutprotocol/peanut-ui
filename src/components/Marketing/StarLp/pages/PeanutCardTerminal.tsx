'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Icon } from '@/components/Global/Icons/Icon'
import { PeanutCardContactless } from './PeanutCardContactless'
import { PeanutCardReaderPing } from './PeanutCardReaderPing'
import type { PeanutCardTerminalProps } from './peanutCard.types'

/**
 * The shop's card reader (drawn: it is the merchant's hardware, not Peanut UI),
 * laid flat as one short row so it shares a screen with the receipt below it:
 * the display with the amount and, once tapped, "Approved"; the contactless
 * mark on the right, toward the phone. On contact the mark lights, one ring
 * bursts and the reader dips 2px, as if it registered the tap.
 */
export function PeanutCardTerminal({ approved, tapping, tapId, inviting }: PeanutCardTerminalProps) {
    const reduceMotion = useReducedMotion()
    const moving = tapping && !reduceMotion

    return (
        <motion.div
            className="flex min-w-0 items-center gap-2 rounded-[1.25rem] border-2 border-border-default bg-background-default p-2.5 shadow-4"
            animate={moving ? { y: [0, 2, 0] } : { y: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
        >
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg bg-gray-950 py-2.5 pr-2 pl-3 text-white xs:pl-3.5">
                <span className="font-roboto-flex-extrabold text-heading-s xs:text-heading-m">$4.50</span>
                <span
                    className={`flex shrink-0 items-center gap-1 rounded-full border-2 border-border-default bg-background-badge-success px-2 py-1 text-label-l text-foreground-primary transition-[opacity,transform] duration-300 ease-spring motion-reduce:transition-none ${approved ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}
                >
                    <Icon name="check" size={16} />
                    Approved
                </span>
            </div>
            <span className="relative grid size-9 shrink-0 place-items-center xs:size-11">
                <span
                    className={`absolute inset-0 rounded-full bg-pink-500 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${tapping ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                />
                {moving && (
                    <motion.span
                        key={tapId}
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-full border-2 border-pink-500"
                        initial={{ scale: 1, opacity: 1 }}
                        animate={{ scale: 1.8, opacity: 0 }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                    />
                )}
                {inviting && !reduceMotion && <PeanutCardReaderPing />}
                <PeanutCardContactless className="relative size-6 xs:size-7" />
            </span>
        </motion.div>
    )
}
