'use client'

import HomeCarouselCTA from './HomeCarouselCTA'

/**
 * Home CTA section that shows carousel items including perk claims.
 * Perk claims are now integrated into HomeCarouselCTA and displayed
 * as standard carousel items with a pink dot indicator.
 * Tapping a perk CTA opens a modal with the gift box claim experience.
 */
export function HomePerkClaimSection() {
    return <HomeCarouselCTA />
}

export default HomePerkClaimSection
