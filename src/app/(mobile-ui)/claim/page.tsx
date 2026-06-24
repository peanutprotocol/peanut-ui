import { Claim } from '@/components/Claim'
import { BASE_URL } from '@/constants/general.consts'
import getOrigin from '@/lib/hosting/get-origin'
import { buildClaimMetadata, getClaimLinkData } from '@/utils/claim-metadata.utils'
import { type Metadata } from 'next'

// Claim previews are resolved per-request from the link's query params, so the
// page must render dynamically on the web. The native (Capacitor static-export)
// build strips this export — scripts/native-build.js replaces this file with a
// metadata-free stub at build time, so SSR-only concerns never reach native.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}): Promise<Metadata> {
    const resolvedSearchParams = await searchParams

    let siteUrl = BASE_URL
    try {
        siteUrl = (await getOrigin()) || BASE_URL
    } catch {
        // getOrigin throws on a missing/invalid host header — fall back to BASE_URL
    }

    const claimData = await getClaimLinkData(resolvedSearchParams, siteUrl)
    return buildClaimMetadata({ claimData, siteUrl })
}

export default function ClaimPage() {
    return <Claim />
}
