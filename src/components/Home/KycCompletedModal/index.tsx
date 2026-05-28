'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import type { IconName } from '@/components/Global/Icons/Icon'
import InfoCard from '@/components/Global/InfoCard'
import { countryData, type CountryData } from '@/components/AddMoney/consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { useCapabilities } from '@/hooks/useCapabilities'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

/** A feature unlocked by identity verification, tagged by the provider that unlocks it. */
type VerificationUnlockItem = {
    title: React.ReactNode | string
    type: 'bridge' | 'manteca'
}

/**
 * MIGRATION-REVIEW: relocated verbatim from `useIdentityVerification.getVerificationUnlockItems`
 * (the legacy hook's only output this modal consumed). It is pure presentational content — a
 * static list of unlocked-feature bullets — with no KYC state, so it has no business living in a
 * hook. `countryTitle` personalizes the Manteca bank-transfer bullet (the user's verified ID
 * country). KycCompletedModal is the sole consumer, so it's inlined here.
 */
const getVerificationUnlockItems = (countryTitle?: string): VerificationUnlockItem[] => [
    {
        title: (
            <p>
                QR Payments in <b>Argentina and Brazil</b>
            </p>
        ),
        type: 'bridge',
    },
    {
        title: (
            <p>
                <b>United States</b> ACH and Wire transfers
            </p>
        ),
        type: 'bridge',
    },
    {
        title: (
            <p>
                <b>Europe</b> SEPA transfers (+30 countries)
            </p>
        ),
        type: 'bridge',
    },
    {
        title: (
            <p>
                <b>Mexico</b> SPEI transfers
            </p>
        ),
        type: 'bridge',
    },
    {
        // Important: This uses the user's verified ID country, not their selected country
        // Example: User picks Argentina but has Brazil ID → they get QR in Argentina
        // but bank transfers only work in Brazil (their verified country)
        title: `Bank transfers to your own accounts in ${countryTitle || 'your country'}`,
        type: 'manteca',
    },
    {
        title: 'QR Payments in Brazil and Argentina',
        type: 'manteca',
    },
]

const KycCompletedModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [approvedCountryData, setApprovedCountryData] = useState<CountryData | null>(null)

    const { hasEnabledRail, railsForProvider } = useCapabilities()
    const isBridgeApproved = hasEnabledRail('bridge')
    const isMantecaApproved = hasEnabledRail('manteca')

    const hasTrackedShow = useRef(false)
    useEffect(() => {
        if (isOpen && !hasTrackedShow.current) {
            hasTrackedShow.current = true
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.KYC_COMPLETED })
        }
    }, [isOpen])

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
    }, [approvedCountryData?.title])

    // MIGRATION-REVIEW: re-sourced off the capability rails. The old effect scanned raw
    // `user.kycVerifications` for an approved MANTECA/SUMSUB row and read its `mantecaGeo`
    // to personalize the "Bank transfers to your own accounts in {country}" bullet. A
    // full-tier Manteca rail now carries that jurisdiction as `rail.country`, so the
    // approved country = an ENABLED Manteca rail's country. `isMantecaSupportedCountryCode`
    // guard kept (matches the old country-gate). NOTE: if multiple enabled Manteca rails
    // exist (AR + BR), this takes the last like the old forEach did — same arbitrary pick.
    const mantecaRails = railsForProvider('manteca')
    useEffect(() => {
        if (!isMantecaApproved) return

        let approvedCountry: string | undefined | null
        mantecaRails.forEach((rail) => {
            if (rail.status === 'enabled' && isMantecaSupportedCountryCode(rail.country)) {
                approvedCountry = rail.country
            }
        })

        if (approvedCountry) {
            const _approvedCountryData = countryData.find(
                (c) => c.iso2?.toUpperCase() === approvedCountry?.toUpperCase()
            )
            setApprovedCountryData(_approvedCountryData || null)
        }
    }, [isMantecaApproved, mantecaRails])

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
