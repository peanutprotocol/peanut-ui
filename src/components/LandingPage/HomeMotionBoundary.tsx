'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './homeMotion.module.css'

/** Suspend decorative CSS motion per fold without changing the shared star-LP kit. */
export function HomeMotionBoundary({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const root = ref.current
        if (!root) return
        const visible = new Set<Element>()
        const scenes = root.querySelectorAll('section, .star-lp-marquee')
        const update = () => {
            scenes.forEach((scene) => {
                scene.setAttribute('data-home-running', String(visible.has(scene) && !document.hidden))
            })
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(({ target, isIntersecting }) => {
                if (isIntersecting) visible.add(target)
                else visible.delete(target)
            })
            update()
        })
        scenes.forEach((scene) => observer.observe(scene))
        document.addEventListener('visibilitychange', update)
        update()
        return () => {
            observer.disconnect()
            document.removeEventListener('visibilitychange', update)
        }
    }, [])

    return (
        <div ref={ref} className={styles.folds}>
            {children}
        </div>
    )
}
