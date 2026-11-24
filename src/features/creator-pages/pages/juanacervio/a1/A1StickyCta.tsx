'use client'

import { useEffect, useRef, useState } from 'react'
import type { NitaA1Copy } from '../nita-a1.copy'
import styles from '../NitaA1.module.css'
import { A1Cta } from './A1Cta'
import { A1InviteLine } from './A1InviteLine'

/**
 * An in-page button counts as on screen from this share of its height. At 0.95 a 48px button
 * shows at least 45px, above the 44px a finger needs; at 0.9 it would show 43px.
 */
const ON_SCREEN_RATIO = 0.95

/**
 * The bottom 100px of the screen do not count as "on screen". An in-app browser can draw its own
 * controls there (Instagram on an iPhone: about 60px) without telling the page, and the observer
 * cannot see them: a button in that band may be covered, so the pinned bar must take over.
 */
const ON_SCREEN_MARGIN = '0px 0px -100px 0px'

/**
 * The store button pinned to the bottom edge. One rule: it shows unless an in-page button is
 * (almost) fully on screen and clear of the bottom 100px. So a whole, tappable store button is
 * on screen at every scroll position. An in-page button low on the screen may show above the bar.
 * It starts hidden for the first HTML; on a short screen, where the post's button sits low,
 * it shows as soon as the script runs.
 */
export function A1StickyCta({
    labels,
    inviteLead,
    inviteName,
}: {
    labels: NitaA1Copy['cta']
    inviteLead: string
    inviteName: string
}) {
    const bar = useRef<HTMLDivElement>(null)
    const [shown, setShown] = useState(false)

    useEffect(() => {
        const inPageButtons = bar.current
            ?.closest('main')
            ?.querySelectorAll('[data-cta-position="hero"], [data-cta-position="footer"]')
        if (!inPageButtons?.length) return

        const onScreen = new Set<Element>()
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.intersectionRatio >= ON_SCREEN_RATIO) onScreen.add(entry.target)
                    else onScreen.delete(entry.target)
                }
                setShown(onScreen.size === 0)
            },
            { threshold: ON_SCREEN_RATIO, rootMargin: ON_SCREEN_MARGIN }
        )
        inPageButtons.forEach((button) => observer.observe(button))
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={bar} data-state={shown ? 'shown' : 'hidden'} className={styles.sticky}>
            <A1Cta labels={labels} position="sticky" />
            <A1InviteLine lead={inviteLead} name={inviteName} />
        </div>
    )
}
