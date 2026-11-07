'use client'

import { useMemo } from 'react'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import MantecaAddMoneyFlow from '@/components/AddMoney/components/MantecaAddMoneyFlow'
import { useParams, useSearchParams } from 'next/navigation'
import { countryData } from '@/components/AddMoney/consts'

/** `countryPath` for a page whose URL names no country: the neutral /add-money/pix names Brazil. */
export default function MantecaAddMoney({ countryPath }: { countryPath?: string } = {}) {
    const params = useParams()
    const urlSearchParams = useSearchParams()
    // path params (web) or query params (native static export), as the route page reads them
    const country = countryPath || (params.country as string) || urlSearchParams.get('country') || ''
    const searchParams = useMemo(() => {
        if (!countryPath) return urlSearchParams
        const withCountry = new URLSearchParams(urlSearchParams.toString())
        withCountry.set('country', countryPath)
        return withCountry
    }, [countryPath, urlSearchParams])
    return (
        <KycFeatureActivationGate
            feature="local"
            scope={{ channel: 'bank', country: countryData.find((c) => c.path === country)?.id }}
        >
            <MantecaAddMoneyFlow searchParams={searchParams} />
        </KycFeatureActivationGate>
    )
}
