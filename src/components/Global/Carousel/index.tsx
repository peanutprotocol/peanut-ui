'use client'
import { useCarouselDotButton } from '@/hooks/useCarouselDotButton'
import useEmblaCarousel from 'embla-carousel-react'

const Carousel = ({ children }: { children: React.ReactNode }) => {
    const [emblaRef, emblaApi] = useEmblaCarousel()
    const { selectedIndex, scrollSnaps, onDotButtonClick } = useCarouselDotButton(emblaApi)
    return (
        <div className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden" ref={emblaRef}>
            <div className="flex w-full gap-2">{children}</div>

            <div className="flex gap-2">
                {scrollSnaps.length > 1 &&
                    scrollSnaps.map((_, index) => (
                        <button
                            className={`size-2 rounded-full ${selectedIndex === index ? 'bg-primary-1' : 'bg-grey-2'}`}
                            key={index}
                            onClick={() => onDotButtonClick(index)}
                        />
                    ))}
            </div>
        </div>
    )
}

export default Carousel
