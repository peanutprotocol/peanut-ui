import { UseEmblaCarouselType } from 'embla-carousel-react'
import { useCallback, useEffect, useState } from 'react'

type UseDotButtonType = {
    selectedIndex: number
    scrollSnaps: number[]
    onDotButtonClick: (index: number) => void
}

/**
 * A hook that manages dot navigation buttons for a carousel
 *
 * This hook helps you create those little dots you see below carousels that:
 * - Show which slide you're currently viewing (highlighted dot)
 * - Let you click on any dot to jump to that specific slide
 * - Keep track of how many slides there are in total
 *
 * @param emblaApi - The Embla carousel API instance
 * @returns An object with:
 *   - selectedIndex: Which slide is currently active (0, 1, 2, etc.)
 *   - scrollSnaps: Array representing all the slides (used to create the dots)
 *   - onDotButtonClick: Function to call when a dot is clicked to jump to that slide
 */
export const useCarouselDotButton = (emblaApi: UseEmblaCarouselType[1]): UseDotButtonType => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

    const onDotButtonClick = useCallback(
        (index: number) => {
            if (!emblaApi) return
            emblaApi.scrollTo(index)
        },
        [emblaApi]
    )

    const onInit = useCallback((emblaApi: UseEmblaCarouselType[1]) => {
        if (!emblaApi) return
        setScrollSnaps(emblaApi.scrollSnapList())
    }, [])

    const onSelect = useCallback((emblaApi: UseEmblaCarouselType[1]) => {
        if (!emblaApi) return
        setSelectedIndex(emblaApi.selectedScrollSnap())
    }, [])

    useEffect(() => {
        if (!emblaApi) return

        onInit(emblaApi)
        onSelect(emblaApi)
        emblaApi.on('reInit', onInit).on('reInit', onSelect).on('select', onSelect)
    }, [emblaApi, onInit, onSelect])

    return {
        selectedIndex,
        scrollSnaps,
        onDotButtonClick,
    }
}
