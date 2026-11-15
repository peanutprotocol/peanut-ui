'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './homeMotion.module.css'

/** Suspend decorative CSS motion without mutating descendants that may still be hydrating. */
export function HomeMotionBoundary({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const root = ref.current
        if (!root) return
        const stylesheet = document.createElement('style')
        document.head.appendChild(stylesheet)
        const sheet = stylesheet.sheet!
        const visible = new Set<Element>()
        const rules = new Map<Element, CSSStyleRule>()
        const update = () => {
            rules.forEach((rule, scene) => {
                rule.style.setProperty(
                    '--home-motion-play',
                    visible.has(scene) && !document.hidden ? 'running' : 'paused',
                    'important'
                )
            })
        }
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
                    // A tall closing fold can enter long before its glove does.
                    const shown = target.matches('.star-lp-wobble') ? intersectionRatio >= 0.35 : isIntersecting
                    if (shown) visible.add(target)
                    else visible.delete(target)
                })
                update()
            },
            { threshold: [0, 0.35] }
        )
        const syncScenes = () => {
            const scenes = Array.from(root.querySelectorAll('section, .star-lp-marquee, #home-close .star-lp-wobble'))
            if (scenes.length === rules.size && scenes.every((scene) => rules.has(scene))) return
            observer.disconnect()
            rules.clear()
            while (sheet.cssRules.length) sheet.deleteRule(0)
            visible.forEach((scene) => {
                if (!scenes.includes(scene)) visible.delete(scene)
            })
            scenes.forEach((scene) => {
                // CSSOM owns the state; React's server-rendered attributes and styles stay untouched.
                const path: string[] = []
                let node: Element = scene
                while (node !== root && node.parentElement) {
                    const index = Array.from(node.parentElement.children).indexOf(node) + 1
                    path.unshift(`:nth-child(${index})`)
                    node = node.parentElement
                }
                const index = sheet.insertRule(`.${styles.folds} > ${path.join(' > ')} {}`, sheet.cssRules.length)
                rules.set(scene, sheet.cssRules[index] as CSSStyleRule)
                observer.observe(scene)
            })
            update()
        }
        // Suspense and the card feature gate can mount folds after this boundary hydrates.
        const mutations = new MutationObserver(syncScenes)
        mutations.observe(root, { childList: true, subtree: true })
        document.addEventListener('visibilitychange', update)
        syncScenes()
        return () => {
            observer.disconnect()
            mutations.disconnect()
            document.removeEventListener('visibilitychange', update)
            stylesheet.remove()
        }
    }, [])

    return (
        <div ref={ref} className={styles.folds}>
            {children}
        </div>
    )
}
