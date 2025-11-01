'use client'

import Carousel from '@/components/Global/Carousel'
import CarouselCTA from './CarouselCTA'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useHomeCarouselCTAs } from '@/hooks/useHomeCarouselCTAs'

const HomeCarouselCTA = () => {
    const { carouselCTAs, setCarouselCTAs } = useHomeCarouselCTAs()

    // don't render carousel if there are no CTAs
    if (!carouselCTAs.length) return null

    return (
        <Carousel>
            {carouselCTAs.map((cta) => (
                <CarouselCTA
                    key={cta.id}
                    title={cta.title}
                    description={cta.description}
                    icon={cta.icon as IconName}
                    onClose={() => {
                        // Use cta.onClose if provided (for notification prompt), otherwise filter from list
                        if (cta.onClose) {
                            cta.onClose()
                        } else {
                            setCarouselCTAs((prev) => prev.filter((c) => c.id !== cta.id))
                        }
                    }}
                    onClick={cta.onClick}
                    logo={cta.logo}
                    iconContainerClassName={cta.iconContainerClassName}
                    isPermissionDenied={cta.isPermissionDenied}
                />
            ))}
        </Carousel>
    )
}

export default HomeCarouselCTA
