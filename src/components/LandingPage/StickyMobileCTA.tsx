'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/0_Bruddle/Button'

/**
 * Sticky bottom CTA bar for mobile. Shows after scrolling past the hero,
 * hides when a section with its own CTA is visible, and hides at the
 * very bottom of the page to avoid blocking scroll-back.
 */

const CTA_SELECTOR = 'section a[href="/setup"], section a[href="/send"], section a[href="/lp/card"]'

export function StickyMobileCTA() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const check = () => {
            // Hide if at the very bottom of the page (prevents scroll-back blocking)
            const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 20
            if (atBottom) {
                setVisible(false)
                return
            }

            // Only show after scrolling past the hero
            if (window.scrollY < 300) {
                setVisible(false)
                return
            }

            // Hide if overlapping an existing CTA
            const ctaEls = document.querySelectorAll(CTA_SELECTOR)
            let overlapping = false

            for (const el of ctaEls) {
                const rect = el.getBoundingClientRect()
                if (rect.bottom > window.innerHeight - 100 && rect.top < window.innerHeight) {
                    overlapping = true
                    break
                }
            }

            setVisible(!overlapping)
        }

        window.addEventListener('scroll', check, { passive: true })
        check()
        return () => window.removeEventListener('scroll', check)
    }, [])

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 border-t-2 border-n-1 bg-white px-4 py-3 md:hidden"
                >
                    <a href="/setup" className="pointer-events-auto block">
                        <Button
                            shadowSize="4"
                            className="w-full bg-primary-1 py-3 text-base font-extrabold hover:bg-primary-1/90"
                        >
                            SIGN UP NOW
                        </Button>
                    </a>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
