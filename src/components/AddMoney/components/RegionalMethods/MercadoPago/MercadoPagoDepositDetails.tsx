'use client'

import NavHeader from '@/components/Global/NavHeader'
import { useParams, useRouter } from 'next/navigation'
import React, { useMemo } from 'react'
import { countryCodeMap, countryData } from '../../../consts'
import MantecaDepositCard from '../../MantecaDepositCard'
import ShareButton from '@/components/Global/ShareButton'

const MercadoPagoDepositDetails = () => {
    const router = useRouter()
    const params = useParams()
    const currentCountryName = params.country as string

    const currentCountryDetails = useMemo(() => {
        // check if we have country params (from dynamic route)
        if (currentCountryName) {
            return countryData.find(
                (country) => country.type === 'country' && country.path === currentCountryName.toLowerCase()
            )
        }
        // Default to Argentina
        return countryData.find((c) => c.id === 'AR')
    }, [currentCountryName])

    const countryCodeForFlag = useMemo(() => {
        const countryId = currentCountryDetails?.id || 'AR'
        const countryCode = countryCodeMap[countryId] || countryId // if countryId is not in countryCodeMap, use countryId because for some countries countryId is of 2 digit and countryCodeMap is a mapping of 3 digit to 2 digit country codes
        return countryCode?.toLowerCase() || 'ar'
    }, [currentCountryDetails])

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={'Add Money'} onPrev={() => router.back()} />

            <MantecaDepositCard countryCodeForFlag={countryCodeForFlag} currencySymbol={'ARS'} amount="124" />

            <ShareButton
                generateText={async () => {
                    return `CBU: [CBU_NUMBER]\nFull name: Manuel Rodríguez Roldán\n[CUIL/CUIT]: 20-39951628-6`
                }}
                title="Bank Transfer Details"
                variant="purple"
                className="w-full"
            >
                Share Details
            </ShareButton>
        </div>
    )
}

export default MercadoPagoDepositDetails
