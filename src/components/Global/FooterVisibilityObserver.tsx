'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { useEffect, useRef } from 'react'

export function FooterVisibilityObserver() {
    const footerRef = useRef<HTMLDivElement>(null)
    const { setIsFooterVisible } = useFooterVisibility()

    useEffect(() => {
        const el = footerRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    setIsFooterVisible(entry.isIntersecting)
                })
            },
            { root: null, rootMargin: '0px', threshold: 0.1 }
        )

        observer.observe(el)

        return () => {
            observer.unobserve(el)
        }
    }, [setIsFooterVisible])

    return <div ref={footerRef} />
}
