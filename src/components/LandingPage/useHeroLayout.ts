'use client'

import { useLayoutEffect, useRef } from 'react'

/** Fit translated words first, then reserve space for the actual signup and login controls. */
export function useHeroLayout(headline: string) {
    const heroRef = useRef<HTMLElement>(null)
    const headlineRef = useRef<HTMLHeadingElement>(null)
    const copyRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const hero = heroRef.current
        const heading = headlineRef.current
        const copy = copyRef.current
        if (!hero || !heading || !copy) return
        let disposed = false

        const measure = () => {
            if (disposed || hero.clientWidth === 0) return
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight
            const mobile = viewportWidth < 768
            const accentSize = mobile ? 68 : Math.min(210, (viewportWidth * 188) / 1440) * 1.02 * 0.98
            const labelSize = mobile ? 38 : Math.min(112, (viewportWidth * 100) / 1440) * 1.02
            const mascotSize = mobile ? Math.min(290, viewportHeight * 0.34) : Math.min(340, viewportHeight * 0.38)
            const setTypeScale = (scale: number) => {
                hero.style.setProperty('--hero-accent-size', `${accentSize * scale}px`)
                hero.style.setProperty('--hero-label-size', `${labelSize * scale}px`)
            }
            const setMascotSize = (size: number) => hero.style.setProperty('--hero-mascot-size', `${size}px`)

            let typeScale = 1
            setTypeScale(typeScale)
            setMascotSize(mascotSize)
            const availableWidth = (heading.parentElement?.clientWidth ?? hero.clientWidth) - 12
            const phrases = Array.from(heading.querySelectorAll<HTMLElement>('[data-hero-phrase]'))
            for (let pass = 0; pass < 3; pass++) {
                const widest = Math.max(
                    ...phrases.map((phrase) => {
                        const parts = Array.from(phrase.children, (part) => part.getBoundingClientRect())
                        return (
                            Math.max(...parts.map((part) => part.right)) - Math.min(...parts.map((part) => part.left))
                        )
                    })
                )
                if (widest <= availableWidth || widest === 0) break
                typeScale *= availableWidth / widest
                setTypeScale(typeScale)
            }

            // Keep the CTA and its real subtext/login visible before reducing the headline.
            const availableHeight = viewportHeight - 8
            const overflow = () => Math.max(0, hero.getBoundingClientRect().height - availableHeight)
            setMascotSize(Math.max(mobile ? 100 : 140, mascotSize - overflow()))
            const remaining = overflow()
            if (remaining > 0 && heading.offsetHeight > 0) {
                typeScale *= Math.max(0.6, (heading.offsetHeight - remaining) / heading.offsetHeight)
                setTypeScale(typeScale)
            }
            hero.dataset.heroLayoutReady = 'true'
        }

        measure()
        void document.fonts?.ready.then(measure)
        const observer = new ResizeObserver(measure)
        observer.observe(copy)
        window.addEventListener('resize', measure)
        return () => {
            disposed = true
            observer.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [headline])

    return { heroRef, headlineRef, copyRef }
}
