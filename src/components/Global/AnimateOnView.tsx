'use client'

import { useRef, useEffect, type CSSProperties } from 'react'

type AnimateOnViewProps = {
    children: React.ReactNode
    className?: string
    delay?: string
    y?: string
    x?: string
    rotate?: string
    style?: CSSProperties
} & React.HTMLAttributes<HTMLElement>

export function AnimateOnView({ children, className, delay, y, x, rotate, style, ...rest }: AnimateOnViewProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    el.classList.add('in-view')
                    observer.disconnect()
                }
            },
            { threshold: 0.1 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div
            ref={ref}
            className={`animate-on-view ${className || ''}`}
            style={
                {
                    '--aov-delay': delay || '0s',
                    '--aov-y': y || '20px',
                    '--aov-x': x || '0px',
                    '--aov-rotate': rotate || '0deg',
                    ...style,
                } as CSSProperties
            }
            {...rest}
        >
            {children}
        </div>
    )
}
