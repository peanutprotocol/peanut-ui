'use client'

import Carousel from '@/components/Global/Carousel'
import CarouselCTA from './CarouselCTA'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useHomeCarouselCTAs } from '@/hooks/useHomeCarouselCTAs'

const HomeCarouselCTA = () => {
    const { carouselCTAs, dismissCTA } = useHomeCarouselCTAs()

    if (carouselCTAs.length === 0) return null

    return (
        <Carousel>
            {carouselCTAs.map((cta) => (
                <CarouselCTA
                    key={cta.id}
                    title={cta.title}
                    description={cta.description}
                    icon={cta.icon as IconName | undefined}
                    concept={cta.concept}
                    onClose={() => {
                        cta.onClose?.()
                        dismissCTA(cta.id)
                    }}
                    onClick={cta.onClick}
                    logo={cta.logo}
                    mascotPose={cta.mascotPose}
                    iconContainerClassName={cta.iconContainerClassName}
                    secondaryIcon={cta.secondaryIcon}
                    iconSize={16}
                    logoSize={cta.logoSize}
                />
            ))}
        </Carousel>
    )
}

export default HomeCarouselCTA
