import { RefObject, useEffect, useState } from 'react'

interface DynamicHeightOptions {
    maxHeightVh?: number
    minHeightVh?: number
    extraVhOffset?: number // extra vh to add to the calculated height
}

/**
 * custom hook to calculate the dynamic height of a referenced element
 * as a percentage of the viewport height (vh), with constraints.
 *
 * @param ref RefObject pointing to the HTML element whose height needs to be measured.
 * @param options Configuration options for max/min height and offset.
 * @returns The calculated height in vh units, or null initially.
 */
export function useDynamicHeight(ref: RefObject<HTMLElement>, options: DynamicHeightOptions = {}): number | null {
    const {
        maxHeightVh = 90, // Default max height 90vh
        minHeightVh = 10, // Default min height 10vh
        extraVhOffset = 5, // Default extra 5vh offset
    } = options

    const [heightVh, setHeightVh] = useState<number | null>(null) // initialize with null

    useEffect(() => {
        const element = ref.current
        if (!element) return

        let initialMeasureDone = false // flag to track initial measurement

        const observer = new ResizeObserver((entries) => {
            window.requestAnimationFrame(() => {
                for (const entry of entries) {
                    const elementHeight = entry.contentRect.height
                    // ensure we don't calculate height based on a 0-height element initially
                    if (elementHeight <= 0 && !initialMeasureDone) continue

                    const calculatedVh = (elementHeight / window.innerHeight) * 100 + extraVhOffset
                    const constrainedVh = Math.max(minHeightVh, Math.min(maxHeightVh, calculatedVh))

                    setHeightVh(constrainedVh)
                    initialMeasureDone = true // mark initial measurement as done
                }
            })
        })

        observer.observe(element)

        return () => observer.disconnect()
    }, [ref, maxHeightVh, minHeightVh, extraVhOffset])

    return heightVh
}
