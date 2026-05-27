'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import type { IconName } from '@/components/Global/Icons/Icon'
import InfoCard from '@/components/Global/InfoCard'
import { useAuth } from '@/context/authContext'
import { countryData, type CountryData } from '@/components/AddMoney/consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { isKycStatusApproved } from '@/constants/kyc.consts'

const KycCompletedModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { user } = useAuth()
    const [approvedCountryData, setApprovedCountryData] = useState<CountryData | null>(null)

    const { hasEnabledRail } = useCapabilities()
    const isBridgeApproved = hasEnabledRail('bridge')
    const isMantecaApproved = hasEnabledRail('manteca')

    const hasTrackedShow = useRef(false)
    useEffect(() => {
        if (isOpen && !hasTrackedShow.current) {
            hasTrackedShow.current = true
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.KYC_COMPLETED })
        }
    }, [isOpen])
    const { getVerificationUnlockItems } = useIdentityVerification()

    // MIGRATION-REVIEW: old logic had a Sumsub branch — `isSumsubApproved &&
    // regionIntent==='LATAM' → 'manteca'`, else 'bridge' — to pick feature bullets while
    // the downstream provider rail hadn't enabled yet. Sumsub has no rail in the capability
    // model, and an approved user now always surfaces as an enabled bridge/manteca rail, so
    // the pre-rail window is gone. Mapped to "enabled rail by provider", preserving the
    // bridge+manteca → 'all', manteca → 'manteca', bridge → 'bridge' priority. The only
    // behavioral drop is the LATAM-region-intent hint; the rail itself now drives the type.
    const kycApprovalType = useMemo(() => {
        if (isBridgeApproved && isMantecaApproved) return 'all'
        if (isMantecaApproved) return 'manteca'
        if (isBridgeApproved) return 'bridge'
        return 'none'
    }, [isBridgeApproved, isMantecaApproved])

    const items = useMemo(() => {
        return getVerificationUnlockItems(approvedCountryData?.title)
    }, [getVerificationUnlockItems, approvedCountryData?.title])

    useEffect(() => {
        // If manteca KYC is approved, then we need to get the approved country
        if (isMantecaApproved) {
            let approvedCountry: string | undefined | null

            // get the manteca approved country
            user?.user.kycVerifications?.forEach((v) => {
                if (
                    // dev: scoped to Manteca via `isMantecaSupportedCountryCode` helper.
                    // main: broadened to include SUMSUB-provider rows AND switched the
                    // status gate from `=== MantecaKycStatus.ACTIVE` to
                    // `isKycStatusApproved` (handles the post-migration cohort whose
                    // status enum is the unified Bridge/Manteca approved set, not the
                    // legacy Manteca-only ACTIVE).
                    // Merge: keep dev's helper for country-gate readability, take
                    // main's broader provider + status logic (the actual bugfix).
                    (v.provider === 'MANTECA' || v.provider === 'SUMSUB') &&
                    isMantecaSupportedCountryCode(v.mantecaGeo) &&
                    isKycStatusApproved(v.status)
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
    }, [isMantecaApproved, user])

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
                    onClick: () => {
                        posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                            modal_type: MODAL_TYPES.KYC_COMPLETED,
                            cta: 'start_sending',
                        })
                        onClose()
                    },
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
