import { useEffect, useState, useRef, useCallback } from 'react'

/** Safety margin multiplier to account for font rendering differences between canvas and DOM */
const SAFETY_MARGIN = 0.9

/**
 * Calculates the optimal truncation for an address to fit within a container width.
 * Returns the formatted address like "0xF3...3he7e" with dynamic character counts.
 *
 * @param address - The full address to truncate
 * @param containerWidth - Available width in pixels
 * @param charWidth - Estimated width per character in pixels (default: 8)
 * @param minChars - Minimum characters to show on each side (default: 4)
 * @returns Formatted address string
 */
export const formatAddressToFitWidth = (
    address: string,
    containerWidth: number,
    charWidth: number = 8,
    minChars: number = 4
): string => {
    if (!address || containerWidth <= 0) return address || ''

    // Apply safety margin to container width
    const safeWidth = containerWidth * SAFETY_MARGIN

    // "..." is 3 characters
    const ellipsisWidth = charWidth * 3

    // Calculate max characters that can fit (excluding ellipsis)
    const availableWidth = safeWidth - ellipsisWidth
    const maxChars = Math.floor(availableWidth / charWidth)

    // If full address fits (with margin), return it
    if (address.length * charWidth <= safeWidth) return address

    // Calculate chars for each side (half on each side)
    const charsPerSide = Math.max(minChars, Math.floor(maxChars / 2))

    const firstBit = address.substring(0, charsPerSide)
    const lastBit = address.substring(address.length - charsPerSide)

    return `${firstBit}...${lastBit}`
}

// Cache for measured char widths to avoid repeated DOM operations
const charWidthCache = new WeakMap<HTMLElement, { width: number; fontKey: string }>()

/**
 * Measures the approximate character width for a given element's font.
 * Results are cached per element to avoid layout thrashing.
 */
const measureCharWidth = (element: HTMLElement): number => {
    const computedStyle = window.getComputedStyle(element)
    const fontKey = `${computedStyle.fontSize}-${computedStyle.fontFamily}-${computedStyle.fontWeight}`

    // Check cache
    const cached = charWidthCache.get(element)
    if (cached && cached.fontKey === fontKey) {
        return cached.width
    }

    // Measure using canvas (no DOM manipulation, much faster)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return 8 // Fallback

    ctx.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`
    const testString = '0123456789abcdefx'
    const width = ctx.measureText(testString).width / testString.length

    // Cache result
    charWidthCache.set(element, { width, fontKey })

    return width
}

interface UseAutoTruncatedAddressOptions {
    /** Minimum characters to show on each side (default: 4) */
    minChars?: number
    /** Extra padding to subtract from container width (default: 0) */
    padding?: number
}

/**
 * React hook that automatically truncates an address to fit within a container.
 * Uses ResizeObserver to adapt to container size changes.
 *
 * @example
 * ```tsx
 * const { containerRef, truncatedAddress } = useAutoTruncatedAddress(depositAddress)
 *
 * return (
 *   <div ref={containerRef}>
 *     {truncatedAddress}
 *   </div>
 * )
 * ```
 */
export const useAutoTruncatedAddress = <T extends HTMLElement = HTMLElement>(
    address: string,
    options: UseAutoTruncatedAddressOptions = {}
): {
    containerRef: (node: T | null) => void
    truncatedAddress: string
} => {
    const { minChars = 4, padding = 0 } = options
    const elementRef = useRef<T | null>(null)
    const [truncatedAddress, setTruncatedAddress] = useState(address)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const rafIdRef = useRef<number | null>(null)
    const lastWidthRef = useRef<number>(0)

    // Store options in refs to avoid recreating callbacks
    const optionsRef = useRef({ minChars, padding, address })
    optionsRef.current = { minChars, padding, address }

    const updateTruncation = useCallback(() => {
        const container = elementRef.current
        const { address: addr, minChars: min, padding: pad } = optionsRef.current

        if (!container || !addr) {
            setTruncatedAddress(addr || '')
            return
        }

        const containerWidth = container.offsetWidth - pad

        // Skip if width hasn't changed (avoid unnecessary work)
        if (containerWidth === lastWidthRef.current && truncatedAddress !== addr) {
            return
        }
        lastWidthRef.current = containerWidth

        const charWidth = measureCharWidth(container)
        const formatted = formatAddressToFitWidth(addr, containerWidth, charWidth, min)

        setTruncatedAddress(formatted)
    }, []) // Empty deps - uses refs for values

    // Debounced update using requestAnimationFrame
    const scheduleUpdate = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current)
        }
        rafIdRef.current = requestAnimationFrame(() => {
            updateTruncation()
            rafIdRef.current = null
        })
    }, [updateTruncation])

    // Stable callback ref
    const containerRef = useCallback(
        (node: T | null) => {
            // Cleanup previous observer
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect()
                resizeObserverRef.current = null
            }

            elementRef.current = node

            if (node) {
                // Initial calculation (immediate, no debounce)
                updateTruncation()

                // Watch for container size changes (debounced)
                resizeObserverRef.current = new ResizeObserver(scheduleUpdate)
                resizeObserverRef.current.observe(node)
            }
        },
        [updateTruncation, scheduleUpdate]
    )

    // Update when address changes
    useEffect(() => {
        lastWidthRef.current = 0 // Reset to force recalculation
        updateTruncation()
    }, [address, minChars, padding, updateTruncation])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect()
            }
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current)
            }
        }
    }, [])

    return {
        containerRef,
        truncatedAddress,
    }
}
