'use client'

/**
 * <SadPeanut /> — inline-SVG sad peanut for the "you don't have the
 * required badge" moment. Authored inline so framer-motion can drive
 * the per-part animation (slow head sway, mouth quiver, tear blink)
 * without rebuilding a static gif.
 *
 * Brand palette via the parent stylesheet: yellow `#FFC900` (secondary-1),
 * black stroke + features. Sized via the wrapping div's CSS — the SVG
 * fills its container at any size.
 */

import { type FC } from 'react'
import { motion } from 'framer-motion'

interface Props {
    className?: string
    /** Pixel size of the rendered SVG (height = width × 1.3 for the peanut shape). */
    size?: number
}

export const SadPeanut: FC<Props> = ({ className, size = 180 }) => {
    return (
        <motion.div
            className={className}
            // Gentle side-to-side sway — the "no, sorry" gesture.
            animate={{ rotate: [-4, 4, -4] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: size, height: size * 1.3, display: 'inline-block' }}
            aria-hidden
        >
            <svg viewBox="0 0 120 156" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                {/* Peanut body — two stacked ovals joined by a waist. */}
                <g stroke="#000" strokeWidth="4" fill="#FFC900" strokeLinejoin="round">
                    <path
                        d="
              M 60 6
              C 92 6, 108 26, 108 52
              C 108 64, 100 72, 92 78
              C 100 84, 108 92, 108 108
              C 108 134, 92 150, 60 150
              C 28 150, 12 134, 12 108
              C 12 92, 20 84, 28 78
              C 20 72, 12 64, 12 52
              C 12 26, 28 6, 60 6 Z
            "
                    />
                </g>

                {/* Bumpy peanut-skin detail — two faint arcs hinting at the texture. */}
                <g stroke="#000" strokeWidth="1.5" fill="none" opacity="0.35">
                    <path d="M 26 40 Q 40 32, 56 36" />
                    <path d="M 68 116 Q 84 122, 96 112" />
                </g>

                {/* Eyes — slightly droopy, looking down-left. */}
                <g fill="#000">
                    <ellipse cx="44" cy="60" rx="4" ry="5" />
                    <ellipse cx="76" cy="60" rx="4" ry="5" />
                </g>
                {/* Eyelids — droopy half-cover to amplify the "sad" read. */}
                <g stroke="#000" strokeWidth="2.5" fill="none" strokeLinecap="round">
                    <path d="M 38 56 Q 44 52, 50 56" />
                    <path d="M 70 56 Q 76 52, 82 56" />
                </g>

                {/* Downturned mouth — gentle quiver via framer-motion path morph. */}
                <motion.path
                    d="M 48 110 Q 60 100, 72 110"
                    stroke="#000"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    animate={{
                        d: [
                            'M 48 110 Q 60 100, 72 110',
                            'M 48 110 Q 60 102, 72 110',
                            'M 48 110 Q 60 100, 72 110',
                        ],
                    }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Tear drop — falls + fades on a loop. */}
                <motion.path
                    d="M 38 72 Q 36 80, 38 86 Q 40 80, 38 72 Z"
                    fill="#7CD0FF"
                    stroke="#000"
                    strokeWidth="1.5"
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [0, 6, 18, 30] }}
                    transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.15, 0.7, 1], ease: 'easeIn' }}
                />
            </svg>
        </motion.div>
    )
}

export default SadPeanut
