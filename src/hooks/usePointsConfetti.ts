import { useEffect, useRef } from 'react'
import { shootDoubleStarConfetti } from '@/utils/confetti'

/**
 * Hook to trigger confetti animation when points are earned
 * @param points - Number of points earned (truthy value triggers confetti)
 * @param elementRef - Ref to the element where confetti should originate from
 */
export const usePointsConfetti = (points: number | undefined, elementRef: React.RefObject<HTMLElement>) => {
    const hasShownConfettiRef = useRef(false)

    useEffect(() => {
        if (points && elementRef.current && !hasShownConfettiRef.current) {
            hasShownConfettiRef.current = true

            // Wait for next frame to ensure layout is complete
            requestAnimationFrame(() => {
                if (elementRef.current) {
                    const rect = elementRef.current.getBoundingClientRect()
                    const x = (rect.left + rect.width / 2) / window.innerWidth
                    const y = (rect.top + rect.height / 2) / window.innerHeight

                    shootDoubleStarConfetti({ origin: { x, y } })
                }
            })
        }
    }, [points, elementRef])
}
