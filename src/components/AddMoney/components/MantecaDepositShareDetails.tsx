'use client'

import NavHeader from '@/components/Global/NavHeader'
import { useParams, useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { countryData } from '@/components/AddMoney/consts'
import ShareButton from '@/components/Global/ShareButton'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { Icon } from '@/components/Global/Icons/Icon'
import Image from 'next/image'
import { Card } from '@/components/0_Bruddle/Card'
import {
    MANTECA_ARG_DEPOSIT_CUIT,
    MANTECA_ARG_DEPOSIT_NAME,
    MANTECA_COUNTRIES_CONFIG,
} from '@/constants/manteca.consts'
import { shortenStringLong, formatCurrency } from '@/utils/general.utils'

const MantecaDepositShareDetails = ({
    depositDetails,
    currencyAmount,
}: {
    depositDetails: MantecaDepositResponseData
    currencyAmount?: string | undefined
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
        if (!currentCountryDetails) return 'Deposit Address'
        return MANTECA_COUNTRIES_CONFIG[currentCountryDetails.id]?.depositAddressLabel ?? 'Deposit Address'
    }, [currentCountryDetails])

    const depositAddress = depositDetails.details.depositAddress
    const shortenedAddress = depositAddress.length > 30 ? shortenStringLong(depositAddress, 10) : depositAddress
    const depositAlias = depositDetails.details.depositAlias
    const depositAmount = currencyAmount ?? depositDetails.stages['1'].thresholdAmount
    let usdAmount = depositDetails.stages['3'].amount
    const currencySymbol = depositDetails.stages['1'].asset
    const exchangeRate = depositDetails.details.price
    let networkFees = depositDetails.details.withdrawCostInAsset
    usdAmount = (Number(usdAmount) - Number(networkFees)).toString()
    if (Number(networkFees) < 0.01) {
        networkFees = '< 0.01 USD'
    } else {
        networkFees = `${formatCurrency(networkFees)} USD`
    }

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
            <NavHeader title={'Add Money'} onPrev={router.back} />
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
                                {currencySymbol} {formatCurrency(depositAmount)}
                            </p>
                            <div className="text-lg font-bold">≈ {formatCurrency(usdAmount)} USD</div>
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
                            <PaymentInfoRow label="Razón Social" value={MANTECA_ARG_DEPOSIT_NAME} />
                            <PaymentInfoRow label="CUIT" value={MANTECA_ARG_DEPOSIT_CUIT} />
                        </>
                    )}
                    <PaymentInfoRow label="Exchange Rate" value={`1 USD = ${exchangeRate} ${currencySymbol}`} />
                    <PaymentInfoRow
                        label="Provider fees"
                        value={networkFees}
                        moreInfoText="Our providers and the blockchain charge a small fee for every transaction. This fee is already accounted for in the amount you see."
                    />
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
