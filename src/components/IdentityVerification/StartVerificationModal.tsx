'use client'

import ActionModal from '../Global/ActionModal'
import InfoCard from '../Global/InfoCard'
import { Icon } from '../Global/Icons/Icon'
import { type Region } from '@/hooks/useIdentityVerification'
import React from 'react'

// unlock benefits shown per region
const REGION_UNLOCK_ITEMS: Record<string, Array<string | React.ReactNode>> = {
    latam: [
        <p key="bank">
            Bank transfers to your own accounts in <b>LATAM</b>
        </p>,
        <p key="qr">
            QR Payments in <b>Argentina and Brazil</b>
        </p>,
    ],
    europe: [
        <p key="sepa">
            <b>Europe</b> SEPA transfers (+30 countries)
        </p>,
        <p key="qr">
            QR Payments in <b>Argentina and Brazil</b>
        </p>,
    ],
    'north-america': [
        <p key="ach">
            <b>United States</b> ACH and Wire transfers
        </p>,
        <p key="mx">
            <b>Mexico</b> SPEI transfers
        </p>,
        <p key="qr">
            QR Payments in <b>Argentina and Brazil</b>
        </p>,
    ],
    'rest-of-the-world': [
        <p key="qr">
            QR Payments in <b>Argentina and Brazil</b>
        </p>,
    ],
}

const DEFAULT_UNLOCK_ITEMS = [<p key="bank">Bank transfers and local payment methods</p>]

interface StartVerificationModalProps {
    visible: boolean
    onClose: () => void
    onStartVerification: () => void
    selectedRegion: Region | null
    isLoading?: boolean
}

const StartVerificationModal = ({
    visible,
    onClose,
    onStartVerification,
    selectedRegion,
    isLoading,
}: StartVerificationModalProps) => {
    const unlockItems = selectedRegion
        ? (REGION_UNLOCK_ITEMS[selectedRegion.path] ?? DEFAULT_UNLOCK_ITEMS)
        : DEFAULT_UNLOCK_ITEMS

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={`Unlock ${selectedRegion?.name ?? 'Region'}`}
            description={
                <p>
                    To send and receive money in this region, verify your identity with a <b>government-issued ID.</b>
                </p>
            }
            descriptionClassName="text-black"
            icon="shield"
            iconContainerClassName="bg-primary-1"
            iconProps={{ className: 'text-black' }}
            ctas={[
                {
                    shadowSize: '4',
                    icon: 'check-circle',
                    text: isLoading ? 'Loading...' : 'Verify now',
                    onClick: onStartVerification,
                    disabled: isLoading,
                },
            ]}
            content={
                <div className="flex w-full flex-col items-start gap-2">
                    <h2 className="text-xs font-bold">What you'll unlock:</h2>
                    <InfoCard
                        variant="info"
                        itemIcon="check"
                        itemIconSize={12}
                        itemIconClassName="text-secondary-7"
                        items={unlockItems}
                    />
                    <div className="flex items-center gap-2">
                        <Icon name="info" size={12} className="text-gray-1" />
                        <p className="text-xs text-gray-1">Peanut doesn't store any of your documents.</p>
                    </div>
                </div>
            }
        />
    )
}

export default StartVerificationModal
