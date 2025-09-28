'use client'

import Carousel from '@/components/Global/Carousel'
import BannerCard from './BannerCard'
import { IconName } from '@/components/Global/Icons/Icon'
import { useBanners } from '@/hooks/useBanners'

const HomeBanners = () => {
    const { banners, setBanners } = useBanners()

    return (
        <Carousel>
            {banners.map((banner) => (
                <BannerCard
                    key={banner.id}
                    title={banner.title}
                    description={banner.description}
                    icon={banner.icon as IconName}
                    onClose={() => setBanners(banners.filter((b) => b.id !== banner.id))}
                />
            ))}
        </Carousel>
    )
}

export default HomeBanners
