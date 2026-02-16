'use client'
import React, { useEffect, useMemo, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import type { IconName } from '@/components/Global/Icons/Icon'
import InfoCard from '@/components/Global/InfoCard'
import { useAuth } from '@/context/authContext'
import { MantecaKycStatus } from '@/interfaces'
import { countryData, MantecaSupportedExchanges, type CountryData } from '@/components/AddMoney/consts'
import useKycStatus from '@/hooks/useKycStatus'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'

const KycCompletedModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { user } = useAuth()
    const [approvedCountryData, setApprovedCountryData] = useState<CountryData | null>(null)

    const { isUserBridgeKycApproved, isUserMantecaKycApproved, isUserSumsubKycApproved } = useKycStatus()
    const { getVerificationUnlockItems } = useIdentityVerification()

    const kycApprovalType = useMemo(() => {
        // sumsub covers all regions, treat as 'all'
        if (isUserSumsubKycApproved) {
            return 'all'
        }
        if (isUserBridgeKycApproved && isUserMantecaKycApproved) {
            return 'all'
        }
        if (isUserBridgeKycApproved) {
            return 'bridge'
        }
        if (isUserMantecaKycApproved) {
            return 'manteca'
        }
        return 'none'
    }, [isUserBridgeKycApproved, isUserMantecaKycApproved, isUserSumsubKycApproved])

    const items = useMemo(() => {
        return getVerificationUnlockItems(approvedCountryData?.title)
    }, [getVerificationUnlockItems, approvedCountryData?.title])

    useEffect(() => {
        // If manteca KYC is approved, then we need to get the approved country
        if (isUserMantecaKycApproved) {
            const supportedCountries = Object.keys(MantecaSupportedExchanges)
            let approvedCountry: string | undefined | null

            // get the manteca approved country
            user?.user.kycVerifications?.forEach((v) => {
                if (
                    v.provider === 'MANTECA' &&
                    supportedCountries.includes((v.mantecaGeo || '').toUpperCase()) &&
                    v.status === MantecaKycStatus.ACTIVE
                ) {
                    approvedCountry = v.mantecaGeo
                }
            })

            if (approvedCountry) {
                const _approvedCountryData = countryData.find(
                    (c) => c.iso2?.toUpperCase() === approvedCountry?.toUpperCase()
                )
                setApprovedCountryData(_approvedCountryData || null)
            }
        }
    }, [isUserMantecaKycApproved, user])

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            icon={'globe-lock' as IconName}
            iconContainerClassName="bg-primary-1 text-black"
            title="Verification completed!"
            ctas={[
                {
                    text: 'Start sending money',
                    onClick: onClose,
                    variant: 'purple',
                    className: 'w-full',
                    shadowSize: '4',
                },
            ]}
            content={
                <div className="flex w-full flex-col items-start gap-2">
                    <p>You now have access to:</p>
                    <InfoCard
                        variant="info"
                        itemIcon="check"
                        itemIconSize={12}
                        itemIconClassName="text-secondary-7"
                        items={items
                            .filter((item) => {
                                if (kycApprovalType === 'all') {
                                    // Show all items except the manteca QR Payments item because this already exists in brige items
                                    return !(
                                        item.type === 'manteca' && item.title === 'QR Payments in Brazil and Argentina'
                                    )
                                }
                                return item.type === kycApprovalType
                            })
                            .map((item) => item.title)}
                    />
                </div>
            }
        />
    )
}

export default KycCompletedModal
