'use client'

import NavHeader from '@/components/Global/NavHeader'
import { useParams, useRouter } from 'next/navigation'
import React, { useMemo } from 'react'
import { countryData } from '@/components/AddMoney/consts'
import ShareButton from '@/components/Global/ShareButton'
import { MantecaDepositResponseData } from '@/types/manteca.types'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { Icon } from '@/components/Global/Icons/Icon'
import Image from 'next/image'
import { Card } from '@/components/0_Bruddle/Card'
import { shortenStringLong } from '@/utils'

const MantecaDepositShareDetails = ({
    depositDetails,
    source,
}: {
    depositDetails: MantecaDepositResponseData
    source: 'bank' | 'regionalMethod'
}) => {
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
        return countryId.toLowerCase()
    }, [currentCountryDetails])

    const depositAddressLabel = useMemo(() => {
        switch (currentCountryDetails?.id) {
            case 'AR':
                return 'CBU'
            case 'BR':
                return 'Pix Key'
            default:
                return 'Deposit Address'
        }
    }, [currentCountryDetails])

    const depositAddress = depositDetails.details.depositAddress
    const shortenedAddress = depositAddress.length > 30 ? shortenStringLong(depositAddress, 10) : depositAddress
    const depositAlias = depositDetails.details.depositAlias
    const depositAmount = depositDetails.stages['1'].thresholdAmount
    const usdAmount = depositDetails.stages['3'].amount
    const currencySymbol = depositDetails.stages['1'].asset
    const exchangeRate = depositDetails.details.price

    const generateShareText = () => {
        const textParts = []
        const currencySymbol = currentCountryDetails?.currency || 'ARS'

        textParts.push(`Amount: ${currencySymbol} ${depositAmount}`)

        if (depositAddress) {
            textParts.push(`${depositAddressLabel}: ${depositAddress}`)
        }
        if (depositAlias) {
            textParts.push(`Alias: ${depositAlias}`)
        }

        return textParts.join('\n')
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={'Add Money'} onPrev={() => router.back()} />
            <div className="my-auto flex h-full w-full flex-col justify-center space-y-4">
                {/* Amount Display Card */}
                <Card className="p-4">
                    <div className="flex items-center space-x-3">
                        <div className="relative h-12 w-12">
                            <Image
                                src={`https://flagcdn.com/w160/${countryCodeForFlag}.png`}
                                alt={`flag`}
                                width={48}
                                height={48}
                                className="h-12 w-12 rounded-full object-cover"
                            />
                            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-1">
                                <Icon name="bank" size={12} />
                            </div>
                        </div>
                        <div>
                            <p className="flex items-center gap-1 text-center text-sm text-gray-600">
                                <Icon name="arrow-down" size={10} /> You're adding
                            </p>
                            <p className="text-2xl font-bold">
                                {currencySymbol} {depositAmount}
                            </p>
                            <div className="text-lg font-bold">≈ {usdAmount} USD</div>
                        </div>
                    </div>
                </Card>
                <h2 className="font-bold">Account details</h2>
                <Card className="space-y-0 rounded-sm px-4">
                    {depositAddress && (
                        <PaymentInfoRow
                            label={depositAddressLabel}
                            value={shortenedAddress}
                            copyValue={depositAddress}
                            allowCopy
                        />
                    )}
                    {depositAlias && <PaymentInfoRow label="Alias" value={depositAlias} allowCopy />}
                    {currentCountryDetails?.id === 'AR' && (
                        <>
                            <PaymentInfoRow label="Razón Social" value="Sixalime Sas" />
                            <PaymentInfoRow label="CUIT" value="30-71678845-3" />
                        </>
                    )}
                    <PaymentInfoRow label="Exchange Rate" value={`1 USD = ${exchangeRate} ${currencySymbol}`} />
                    <PaymentInfoRow label="Peanut fee" value="Sponsored by Peanut!" hideBottomBorder />
                </Card>
            </div>

            <ShareButton
                generateText={async () => generateShareText()}
                title="Bank Transfer Details"
                variant="purple"
                className="w-full"
            >
                Share Details
            </ShareButton>
        </div>
    )
}

export default MantecaDepositShareDetails
