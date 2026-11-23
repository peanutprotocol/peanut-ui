'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { PEANUT_SITTING } from '@/assets/mascot'
import PeanutMascot from '@/components/Global/PeanutMascot'
import styles from './CreatorPageMascot.module.css'

/** The loop starts to load when the mascot is within this distance of the screen. */
const LOAD_MARGIN = '400px 0px'

/**
 * The mascot that points down at a store button: the approved `pointing-down` loop.
 *
 * The first HTML holds the approved sitting still, lazy-loaded. It stays for a visitor without
 * scripts and for one who asks for reduced motion. For everyone else the loop replaces it, and
 * its player and animation download only after the page has loaded and the mascot is near the
 * screen: the loop never competes with the page's first picture.
 */
export function CreatorPageMascot({ className }: { className?: string }) {
    const box = useRef<HTMLDivElement>(null)
    const [playsLoop, setPlaysLoop] = useState(false)

    useEffect(() => {
        const element = box.current
        if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return
                observer.disconnect()
                setPlaysLoop(true)
            },
            { rootMargin: LOAD_MARGIN }
        )
        const watch = () => observer.observe(element)
        if (document.readyState === 'complete') watch()
        else window.addEventListener('load', watch, { once: true })

        return () => {
            window.removeEventListener('load', watch)
            observer.disconnect()
        }
    }, [])

    return (
        <div ref={box} className={className ? `${styles.mascot} ${className}` : styles.mascot} aria-hidden>
            {playsLoop && <PeanutMascot pose="pointing-down" className="absolute inset-0 size-full" />}
            <Image src={PEANUT_SITTING} alt="" width={112} height={135} />
        </div>
    )
}
