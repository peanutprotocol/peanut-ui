'use client'
import { CarouselDots } from '@/components/0_Bruddle/CarouselDots'
import { useCarouselDotButton } from '@/hooks/useCarouselDotButton'
import useEmblaCarousel from 'embla-carousel-react'

const Carousel = ({ children }: { children: React.ReactNode }) => {
    const [emblaRef, emblaApi] = useEmblaCarousel()
    const { selectedIndex, scrollSnaps, onDotButtonClick } = useCarouselDotButton(emblaApi)
    return (
        <div className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden" ref={emblaRef}>
            <div className="flex w-full gap-2">{children}</div>

            {scrollSnaps.length > 1 && (
                <CarouselDots count={scrollSnaps.length} activeIndex={selectedIndex} onSelect={onDotButtonClick} />
            )}
        </div>
    )
}

export default Carousel
