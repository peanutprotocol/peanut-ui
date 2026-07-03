'use client'
import { useEffect } from 'react'
import { getFromCookie, saveToCookie } from '@/utils/general.utils'
import { resolveCampaign } from '@/components/Invites/campaign-maps'

// Persist an inbound campaign / utm_campaign tag as early as possible so it
// survives navigation, refresh, and cross-device QR hand-off until signup
// consumes it (useZeroDev reads the `campaignTag` cookie at registration).
//
// Historically the tag was written on a single page (/invite's Claim handler)
// as a session cookie, so it was lost on: the desktop QR hand-off (the phone
// that scans it has no cookie), direct /setup landings, and browser close mid-
// funnel. Capturing on every initial page load — with a 30-day expiry — closes
// all three gaps. Campaign links are always fresh external loads, so a
// run-once effect is enough; resolution/precedence lives in campaign-maps.
export function useCaptureCampaign() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const campaign = resolveCampaign(
            params.get('campaign') || params.get('campaignTag'),
            undefined,
            params.get('utm_campaign')?.toLowerCase()
        )
        if (campaign && getFromCookie('campaignTag') !== campaign) {
            saveToCookie('campaignTag', campaign, 30)
        }
    }, [])
}
