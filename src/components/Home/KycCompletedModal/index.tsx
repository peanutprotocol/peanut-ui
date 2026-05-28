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

/** A feature unlocked by identity verification, tagged by which channel unlocked it. */
type UnlockItem = {
    title: React.ReactNode | string
    /** `bank` = shown when bank rails are enabled (US/EU/MX users). `qr` = shown
     * when QR-pay is enabled (LATAM users). Bullets in both groups display when
     * both unlock — the duplicate QR bullet between groups is de-duped below. */
    type: 'bank' | 'qr'
}

/**
 * Static list of unlocked-feature bullets. `countryTitle` personalizes the
 * LATAM bank-transfer bullet (the user's verified ID country).
 */
const getUnlockItems = (countryTitle?: string): UnlockItem[] => [
    {
        title: (
            <p>
                QR Payments in <b>Argentina and Brazil</b>
            </p>
        ),
        type: 'bank',
    },
    {
        title: (
            <p>
                <b>United States</b> ACH and Wire transfers
            </p>
        ),
        type: 'bank',
    },
    {
        title: (
            <p>
                <b>Europe</b> SEPA transfers (+30 countries)
            </p>
        ),
        type: 'bank',
    },
    {
        title: (
            <p>
                <b>Mexico</b> SPEI transfers
            </p>
        ),
        type: 'bank',
    },
    {
        // Important: this uses the user's verified ID country, not their selected country.
        // Example: user picks Argentina but has Brazil ID → they get QR in Argentina
        // but bank transfers only work in Brazil (their verified country).
        title: `Bank transfers to your own accounts in ${countryTitle || 'your country'}`,
        type: 'qr',
    },
    {
        title: 'QR Payments in Brazil and Argentina',
        type: 'qr',
    },
]

const KycCompletedModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [approvedCountryData, setApprovedCountryData] = useState<CountryData | null>(null)

    // Provider-blind: the celebration modal splits its copy by what CHANNEL the
    // user just unlocked, not which provider's rail enabled. Bank-channel = the
    // "transfers" bullets; qr-only OR a Manteca rail's `pay` op = the "QR" bullets.
    // (Manteca's pool tier shows up via canDo('pay') without naming the provider.)
    const { canDo, rails, bankRails, channelOf } = useCapabilities()
    const hasBankUnlock = bankRails().some((rail) => rail.status === 'enabled')
    const hasQrUnlock = canDo('pay')

    const hasTrackedShow = useRef(false)
    useEffect(() => {
        if (isOpen && !hasTrackedShow.current) {
            hasTrackedShow.current = true
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.KYC_COMPLETED })
        }
    }, [isOpen])

    // Pick which feature bullets to show based on the channels the user unlocked.
    // 'all' = bank + qr; 'bank' = bank only (US/EU/MX user); 'qr' = qr-only
    // (LATAM pool-tier user). Drives the bulletshown by `items` below.
    const unlockedChannels: 'all' | 'bank' | 'qr' | 'none' = useMemo(() => {
        if (hasBankUnlock && hasQrUnlock) return 'all'
        if (hasQrUnlock) return 'qr'
        if (hasBankUnlock) return 'bank'
        return 'none'
    }, [hasBankUnlock, hasQrUnlock])

    const items = useMemo(() => {
        return getUnlockItems(approvedCountryData?.title)
    }, [approvedCountryData?.title])

    // Personalize the "Bank transfers to your own accounts in {country}" bullet
    // off the user's first enabled qr-only-or-pay-capable LATAM rail. Provider-
    // blind via the channel classifier — the qr-only channel today is exactly
    // the set that drives this bullet ("approved in country X for QR + bank
    // transfers"). NOTE: if multiple enabled qr-pay rails exist, this picks the
    // last (matches the old forEach behavior).
    const qrCapableRails = useMemo(
        () => rails.filter((rail) => rail.status === 'enabled' && channelOf(rail) === 'qr-only'),
        [rails, channelOf]
    )
    useEffect(() => {
        if (!hasQrUnlock) return
        let approvedCountry: string | undefined | null
        qrCapableRails.forEach((rail) => {
            if (isMantecaSupportedCountryCode(rail.country)) {
                approvedCountry = rail.country
            }
        })
        if (approvedCountry) {
            const _approvedCountryData = countryData.find(
                (c) => c.iso2?.toUpperCase() === approvedCountry?.toUpperCase()
            )
            setApprovedCountryData(_approvedCountryData || null)
        }
    }, [hasQrUnlock, qrCapableRails])

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            icon={'globe-lock' as IconName}
            iconContainerClassName="bg-primary-1 text-black"
            title="🎉 You're unlocked"
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
                    <p>You can now:</p>
                    <InfoCard
                        variant="info"
                        itemIcon="check"
                        itemIconSize={12}
                        itemIconClassName="text-secondary-7"
                        items={items
                            .filter((item) => {
                                if (unlockedChannels === 'all') {
                                    // Show all items except the duplicate QR bullet
                                    // (the bank list already mentions QR in AR/BR).
                                    return !(item.type === 'qr' && item.title === 'QR Payments in Brazil and Argentina')
                                }
                                return item.type === unlockedChannels
                            })
                            .map((item) => item.title)}
                    />
                </div>
            }
        />
    )
}

export default KycCompletedModal
