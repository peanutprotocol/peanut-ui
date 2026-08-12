'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/0_Bruddle/Button'
import type { LandingStrings } from './landingStrings'

/** Scroll distance before the bar comes up. */
const SHOW_AFTER_PX = 300

/** Distance from the document bottom where the footer takes over. */
const BOTTOM_GUARD_PX = 100

/**
 * The bar repeats the CTAs of these two beats, so it steps aside while either
 * one is on screen. Ids are set by WorksToday and NotForYou.
 */
const OWN_CTA_SECTION_IDS = ['works-today', 'not-for-you']

export function StickyMobileCTA({ strings }: { strings: LandingStrings }) {
    const [scrolledPast, setScrolledPast] = useState(false)
    const [ownCtaOnScreen, setOwnCtaOnScreen] = useState(false)
    const rafId = useRef(0)
    const lastScrolledPast = useRef(false)

    useEffect(() => {
        const check = () => {
            const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - BOTTOM_GUARD_PX
            const next = window.scrollY >= SHOW_AFTER_PX && !atBottom

            if (next !== lastScrolledPast.current) {
                lastScrolledPast.current = next
                setScrolledPast(next)
            }
        }

        const onScroll = () => {
            cancelAnimationFrame(rafId.current)
            rafId.current = requestAnimationFrame(check)
        }

        window.addEventListener('scroll', onScroll, { passive: true })
        check()
        return () => {
            window.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(rafId.current)
        }
    }, [])

    useEffect(() => {
        const sections = OWN_CTA_SECTION_IDS.map((id) => document.getElementById(id)).filter(
            (section): section is HTMLElement => section !== null
        )
        if (!sections.length) return

        const onScreen = new Set<Element>()
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) onScreen.add(entry.target)
                else onScreen.delete(entry.target)
            }
            setOwnCtaOnScreen(onScreen.size > 0)
        })

        sections.forEach((section) => observer.observe(section))
        return () => observer.disconnect()
    }, [])

    return (
        <AnimatePresence>
            {scrolledPast && !ownCtaOnScreen && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex items-center gap-2 border-t-2 border-n-1 bg-white px-4 py-3 md:hidden"
                >
                    <Link href="/setup" className="pointer-events-auto flex-[58]">
                        <Button variant="purple" shadowSize="4" className="w-full px-2 py-3 text-base font-extrabold">
                            {strings.signUpNow}
                        </Button>
                    </Link>
                    <Link href="/shhhhh" className="pointer-events-auto flex-[42]">
                        <Button
                            variant="stroke"
                            shadowSize="4"
                            className="w-full whitespace-nowrap px-2 py-3 text-sm font-extrabold"
                        >
                            {strings.tryTheDoor}
                        </Button>
                    </Link>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
