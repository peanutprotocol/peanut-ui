'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

interface FloatingReferralButtonProps {
    onClick: () => void
}

const FloatingReferralButton: React.FC<FloatingReferralButtonProps> = ({ onClick }) => {
    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, { source: 'floating_button' })
    }, [])

    return (
        <button
            onClick={() => {
                posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, { source: 'floating_button' })
                onClick()
            }}
            className="absolute right-1 top-20 z-50 !w-12 animate-pulse cursor-pointer text-4xl transition-all duration-300 hover:scale-110 hover:animate-none md:hidden"
            aria-label="Open referral campaign"
        >
            💝
        </button>
    )
}

export default FloatingReferralButton
