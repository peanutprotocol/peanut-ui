'use client'

import { useEffect, useRef, useState } from 'react'
import styles from '../NitaA1.module.css'
import { A1Cta } from './A1Cta'

/** In-app browsers lay a toolbar over the bottom of the page; a button under it does not count as visible. */
const TOOLBAR_ALLOWANCE_PX = 96

/**
 * The store button pinned to the bottom edge. It shows whenever neither in-page button is on screen.
 * Before hydration CSS decides from the viewport height (`data-state="auto"`), so a short phone has the button at first paint.
 */
export function A1StickyCta() {
    const bar = useRef<HTMLDivElement>(null)
    const [state, setState] = useState<'auto' | 'shown' | 'hidden'>('auto')

    useEffect(() => {
        const inPageButtons = bar.current
            ?.closest('main')
            ?.querySelectorAll('[data-cta-position="hero"], [data-cta-position="footer"]')
        if (!inPageButtons?.length) return

        const onScreen = new Set<Element>()
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.intersectionRatio >= 0.9) onScreen.add(entry.target)
                    else onScreen.delete(entry.target)
                }
                setState(onScreen.size > 0 ? 'hidden' : 'shown')
            },
            { rootMargin: `0px 0px -${TOOLBAR_ALLOWANCE_PX}px 0px`, threshold: [0, 0.9] }
        )
        inPageButtons.forEach((button) => observer.observe(button))
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={bar} data-state={state} className={styles.sticky}>
            <A1Cta position="sticky" />
        </div>
    )
}
