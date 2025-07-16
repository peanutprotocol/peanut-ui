import { useEffect, useState, useMemo } from 'react'

// Event handler hooks
export function useScrollHandler(throttleMs = 16) {
    const [scrollY, setScrollY] = useState(0)

    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null

        const handleScroll = () => {
            if (timeoutId) return
            
            timeoutId = setTimeout(() => {
                setScrollY(window.scrollY)
                timeoutId = null
            }, throttleMs)
        }

        handleScroll()
        window.addEventListener('scroll', handleScroll)
        
        return () => {
            window.removeEventListener('scroll', handleScroll)
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [throttleMs])

    return scrollY
}

export function useResizeHandler(throttleMs = 16) {
    const [screenWidth, setScreenWidth] = useState(1080)

    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null

        const handleResize = () => {
            if (timeoutId) return
            
            timeoutId = setTimeout(() => {
                setScreenWidth(window.innerWidth)
                timeoutId = null
            }, throttleMs)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        
        return () => {
            window.removeEventListener('resize', handleResize)
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [throttleMs])

    return screenWidth
}

// Animation factory functions
export function createButtonAnimation(buttonVisible: boolean, buttonScale = 1, customInitial = {}, customHover = {}) {
    return {
        initial: {
            opacity: 0,
            translateY: 4,
            translateX: 0,
            rotate: 0.75,
            ...customInitial,
        },
        animate: {
            opacity: buttonVisible ? 1 : 0,
            translateY: buttonVisible ? 0 : 20,
            translateX: buttonVisible ? 0 : 20,
            rotate: buttonVisible ? 0 : 1,
            scale: buttonScale,
            pointerEvents: buttonVisible ? ('auto' as const) : ('none' as const),
        },
        hover: {
            translateY: 6,
            translateX: 0,
            rotate: 0.75,
            ...customHover,
        },
        transition: { type: 'spring', damping: 15 },
    }
}

export function createStarAnimation(delay = 0.2, damping = 5, customInitial = {}, customAnimate = {}) {
    return {
        initial: {
            opacity: 0,
            translateY: 20,
            translateX: 5,
            rotate: 45,
            ...customInitial,
        },
        whileInView: {
            opacity: 1,
            translateY: 0,
            translateX: 0,
            rotate: 45,
            ...customAnimate,
        },
        transition: {
            type: 'spring',
            damping,
            delay,
        },
    }
}

export function createCloudAnimation(side: 'left' | 'right', width: number, speed: number, screenWidth: number) {
    const vpWidth = screenWidth || 1080
    const totalDistance = vpWidth + width

    return {
        initial: { x: side === 'left' ? -width : vpWidth },
        animate: { x: side === 'left' ? vpWidth : -width },
        transition: {
            ease: 'linear',
            duration: totalDistance / speed,
            repeat: Infinity,
        },
    }
}

export function createAccordionAnimation(isOpen: boolean, duration = 0.4, iconRotation = 180) {
    return {
        container: {
            animate: { height: 'auto' },
            transition: { duration },
        },
        icon: {
            animate: { rotate: isOpen ? iconRotation : 0 },
            transition: { duration: duration * 0.75, transformOrigin: 'center' },
        },
        content: {
            initial: { height: 0, opacity: 0 },
            animate: { height: 'auto', opacity: 1 },
            exit: { height: 0, opacity: 0 },
            transition: { duration: duration * 0.5 },
        },
    }
}