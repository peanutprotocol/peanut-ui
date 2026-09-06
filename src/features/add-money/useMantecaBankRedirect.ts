'use client'

import { countryData } from '@/components/AddMoney/consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { rewriteMethodPath } from '@/utils/native-routes'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'

// Manteca countries (BR/AR) deposit via their own PIX / Mercado Pago flow, not
// the Bridge SEPA page — getCurrencyConfig has no BR/AR branch, so the Bridge
// page would render the amount in EUR. A KYC-success redirect or a deep link
// can still target /add-money/[country]/bank for a Manteca country, so bounce
// it here — before the Bridge page mounts — and never run its data hooks / URL
// effects for BR/AR. Uses the same predicate the root dispatcher routes with
// (add-money/page.tsx) so the two can't disagree on which countries are Manteca.
export function useMantecaBankRedirect() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()

    const selectedCountryPath = (params.country as string) || searchParams.get('country') || ''
    const selectedCountry = useMemo(() => {
        if (!selectedCountryPath) return null
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])
    const isMantecaRoute = !!selectedCountry && isMantecaSupportedCountryCode(selectedCountry.id)

    useEffect(() => {
        if (isMantecaRoute && selectedCountry) {
            router.replace(rewriteMethodPath(`/add-money/${selectedCountry.path}/manteca`))
        }
    }, [isMantecaRoute, selectedCountry, router])

    return { isMantecaRoute }
}
