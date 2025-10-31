'use client'

import Carousel from '@/components/Global/Carousel'
import BannerCard from './BannerCard'
import NotificationBanner from '@/components/Notifications/NotificationBanner'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useBanners } from '@/hooks/useBanners'

const HomeBanners = () => {
    const { banners, setBanners } = useBanners()

    // don't render carousel if there are no banners
    if (!banners.length) return null

    return (
        <Carousel>
            {banners.map((banner) => {
                // use the existing NotificationBanner component for notification banners
                if (banner.id === 'notification-banner') {
                    return (
                        <div key={banner.id} className="embla__slide">
                            <NotificationBanner
                                onClick={banner.onClick!}
                                onClose={banner.onClose!}
                                isPermissionDenied={banner.isPermissionDenied!}
                            />
                        </div>
                    )
                }

                // use BannerCard for all other banners
                return (
                    <BannerCard
                        key={banner.id}
                        title={banner.title}
                        description={banner.description}
                        icon={banner.icon as IconName}
                        onClose={() => {
                            setBanners(banners.filter((b) => b.id !== banner.id))
                        }}
                        onClick={banner.onClick}
                        logo={banner.logo}
                        iconContainerClassName={banner.iconContainerClassName}
                    />
                )
            })}
        </Carousel>
    )
}

export default HomeBanners
