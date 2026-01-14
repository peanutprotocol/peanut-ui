'use client'

import NavHeader from '@/components/Global/NavHeader'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { useLimits } from '@/hooks/useLimits'
import useKycStatus from '@/hooks/useKycStatus'
import { useRouter } from 'next/navigation'
import { MAX_QR_PAYMENT_AMOUNT_FOREIGN } from '@/constants/payment.consts'
import Image from 'next/image'
import * as Accordion from '@radix-ui/react-accordion'
import { useQueryState, parseAsStringEnum } from 'nuqs'
import { useState } from 'react'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { BANK_TRANSFER_REGIONS, QR_COUNTRIES, type BridgeRegion, type QrCountryId } from '../consts'

/**
 * displays bridge limits for na/europe/mx users
 * shows per-transaction limits and qr payment limits for foreign users
 * url state: ?region=us|mexico|europe|argentina|brazil (persists source region)
 */
const BridgeLimitsView = () => {
    const router = useRouter()
    const { bridgeLimits, isLoading, error } = useLimits()
    const { isUserMantecaKycApproved } = useKycStatus()

    // url state for source region (where user came from)
    const [region] = useQueryState(
        'region',
        parseAsStringEnum<BridgeRegion>(['us', 'mexico', 'europe', 'argentina', 'brazil']).withDefault('us')
    )

    // local state for qr accordion (doesn't affect url)
    const [expandedCountry, setExpandedCountry] = useState<QrCountryId | undefined>(undefined)

    // determine what to show based on source region
    const showBankTransferLimits = BANK_TRANSFER_REGIONS.includes(region)

    // format limit amount with currency symbol
    const formatLimit = (amount: string, asset: string) => {
        const symbol = asset === 'USD' ? '$' : asset
        return `${symbol}${Number(amount).toLocaleString()}`
    }

    return (
        <div className="flex min-h-[inherit] flex-col space-y-6">
            <NavHeader title="Limits" onPrev={() => router.back()} titleClassName="text-xl md:text-2xl" />

            {isLoading && <PeanutLoading coverFullScreen />}

            {error && (
                <Card position="single" className="bg-error-1 text-error">
                    <p className="text-sm">Failed to load limits. Please try again.</p>
                </Card>
            )}

            {!isLoading && !error && bridgeLimits && (
                <>
                    {/* main limits card - only for bank transfer regions */}
                    {showBankTransferLimits && (
                        <div className="space-y-2">
                            <h3 className="font-bold">Fiat limits:</h3>
                            <Card position="single" className="space-y-2 p-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Icon name="check" className="text-success-1" size={16} />
                                        <span className="text-sm">
                                            <span className="font-medium">Add money:</span> up to{' '}
                                            {formatLimit(bridgeLimits.onRampPerTransaction, bridgeLimits.asset)} per
                                            transaction
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon name="check" className="text-success-1" size={16} />
                                        <span className="text-sm">
                                            <span className="font-medium">Withdrawing:</span> up to{' '}
                                            {formatLimit(bridgeLimits.offRampPerTransaction, bridgeLimits.asset)} per
                                            transaction
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* qr payment limits accordion - for bridge users without manteca kyc */}
                    {!isUserMantecaKycApproved && (
                        <div className="space-y-2">
                            <h3 className="font-bold">QR payment limits:</h3>
                            <Card position="single" className="p-0">
                                <Accordion.Root
                                    type="single"
                                    collapsible
                                    value={expandedCountry}
                                    onValueChange={(value) => setExpandedCountry(value as QrCountryId | undefined)}
                                >
                                    {QR_COUNTRIES.map((country, index) => (
                                        <Accordion.Item
                                            key={country.id}
                                            value={country.id}
                                            className={index < QR_COUNTRIES.length - 1 ? 'border-b border-gray-2' : ''}
                                        >
                                            <Accordion.Header>
                                                <Accordion.Trigger className="group flex w-full items-center justify-between px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Image
                                                            src={country.flag}
                                                            alt={country.name}
                                                            width={24}
                                                            height={24}
                                                            className="size-5 rounded-full object-cover"
                                                        />
                                                        <span className="text-sm font-medium">{country.name}</span>
                                                    </div>
                                                    <Icon
                                                        name="chevron-down"
                                                        size={16}
                                                        className="transition-transform duration-300 group-data-[state=open]:rotate-180"
                                                    />
                                                </Accordion.Trigger>
                                            </Accordion.Header>
                                            <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                                                <div className="flex items-center gap-2 px-4 pb-3">
                                                    <Icon name="check" className="text-success-1" size={16} />
                                                    <span className="text-sm">
                                                        Paying with QR: up to $
                                                        {MAX_QR_PAYMENT_AMOUNT_FOREIGN.toLocaleString()} per transaction
                                                    </span>
                                                </div>
                                            </Accordion.Content>
                                        </Accordion.Item>
                                    ))}
                                </Accordion.Root>
                            </Card>
                        </div>
                    )}

                    <a
                        // TODO: add link to docs
                        href=""
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-center text-sm underline"
                    >
                        See more about limits
                    </a>
                </>
            )}

            {!isLoading && !error && !bridgeLimits && (
                <Card position="single">
                    <p className="text-sm text-grey-1">No limits data available.</p>
                </Card>
            )}
        </div>
    )
}

export default BridgeLimitsView
