'use client'

import { useEffect, useState } from 'react'
import { readSignupAttribution } from '@/utils/signup-attribution'
import {
    buildMarketingQrUrl,
    validateMarketingQrCampaign,
    type MarketingQrContext,
    type MarketingQrCampaign,
} from './contract'
import { marketingQrAnalyticsAllowed } from './consent'

/** Read only campaign labels on the displaying browser; never transfer its identity. */
export function useMarketingQrUrl({
    origin,
    context,
    enabled = true,
}: {
    origin: string
    context?: MarketingQrContext
    enabled?: boolean
}): string | null {
    const [url, setUrl] = useState<string | null>(null)
    const page = context?.page
    const placement = context?.placement
    const locale = context?.locale

    useEffect(() => {
        if (!enabled || !page || !placement || !locale || process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING !== 'true') {
            setUrl(null)
            return
        }
        const analyticsEnabled = marketingQrAnalyticsAllowed()
        let savedCampaign: MarketingQrCampaign | undefined
        if (analyticsEnabled) {
            const attribution = readSignupAttribution()
            savedCampaign = [attribution?.lastTouch, attribution?.firstContentTouch, attribution?.firstTouch]
                .map((touch) =>
                    touch
                        ? validateMarketingQrCampaign({
                              source: touch.utmSource,
                              medium: touch.utmMedium,
                              campaign: touch.utmCampaign,
                              content: touch.utmContent,
                          })
                        : null
                )
                .find((campaign): campaign is MarketingQrCampaign => campaign !== null)
        }
        setUrl(
            buildMarketingQrUrl({
                origin,
                context: { page, placement, locale },
                searchParams: new URLSearchParams(window.location.search),
                savedCampaign,
                analyticsEnabled,
            })
        )
    }, [origin, page, placement, locale, enabled])

    return enabled && page && placement && locale ? url : null
}
