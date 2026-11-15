'use client'

import { useEffect, useRef, useState } from 'react'
import styles from '../NitaA1.module.css'
import { A1Cta } from './A1Cta'

/**
 * The store button pinned to the bottom edge. One rule: it shows only while no part of an in-page
 * button is on screen. So it never covers an in-page button, and two store buttons never show at once.
 * It starts hidden, because the first screen normally holds the button in the post card.
 */
export function A1StickyCta() {
    const bar = useRef<HTMLDivElement>(null)
    const [shown, setShown] = useState(false)

    useEffect(() => {
        const inPageButtons = bar.current
            ?.closest('main')
            ?.querySelectorAll('[data-cta-position="hero"], [data-cta-position="footer"]')
        if (!inPageButtons?.length) return

        const onScreen = new Set<Element>()
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) onScreen.add(entry.target)
                else onScreen.delete(entry.target)
            }
            setShown(onScreen.size === 0)
        })
        inPageButtons.forEach((button) => observer.observe(button))
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={bar} data-state={shown ? 'shown' : 'hidden'} className={styles.sticky}>
            <A1Cta position="sticky" />
        </div>
    )
}
