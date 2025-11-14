'use client'

import ActionModal from '../Global/ActionModal'
import InfoCard from '../Global/InfoCard'
import { Icon } from '../Global/Icons/Icon'
import { MantecaSupportedExchanges } from '../AddMoney/consts'
import { useMemo } from 'react'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'

interface StartVerificationModalProps {
    visible: boolean
    onClose: () => void
    onStartVerification: () => void
    selectedIdentityCountry: { id: string; title: string }
    selectedCountry: { id: string; title: string }
}

const StartVerificationModal = ({
    visible,
    onClose,
    onStartVerification,
    selectedIdentityCountry,
    selectedCountry,
}: StartVerificationModalProps) => {
    const { getVerificationUnlockItems } = useIdentityVerification()

    const items = useMemo(() => {
        return getVerificationUnlockItems(selectedIdentityCountry.title)
    }, [getVerificationUnlockItems, selectedIdentityCountry.title])

    const isIdentityMantecaCountry = useMemo(
        () => Object.prototype.hasOwnProperty.call(MantecaSupportedExchanges, selectedIdentityCountry.id.toUpperCase()),
        [selectedIdentityCountry.id]
    )

    const isSelectedCountryMantecaCountry = useMemo(
        () => Object.prototype.hasOwnProperty.call(MantecaSupportedExchanges, selectedCountry.id.toUpperCase()),
        [selectedCountry]
    )

    const getDescription = () => {
        if (isSelectedCountryMantecaCountry && isIdentityMantecaCountry) {
            return (
                <p>
                    To send and receive money <b>locally,</b> you'll need to verify your identity with a
                    government-issued ID from <b>{selectedCountry.title}.</b>
                </p>
            )
        }

        if (isSelectedCountryMantecaCountry && !isIdentityMantecaCountry) {
            return `Without an ${selectedCountry.title} Issued ID, you can still pay in stores using QR codes but you won't be able to transfer money directly to bank accounts.`
        }

        return (
            <p>
                To make <b>international</b> money transfers, you must verify your identity using a government-issued
                ID.
            </p>
        )
    }

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={
                isSelectedCountryMantecaCountry ? `Unlock ${selectedCountry.title}` : 'Unlock International Transfers'
            }
            description={getDescription()}
            descriptionClassName="text-black"
            icon="shield"
            iconContainerClassName="bg-primary-1"
            iconProps={{ className: 'text-black' }}
            ctas={[
                {
                    shadowSize: '4',
                    icon: 'check-circle',
                    text: 'Verify now',
                    onClick: onStartVerification,
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
                        items={items
                            .filter((item) => item.type === (isIdentityMantecaCountry ? 'manteca' : 'bridge'))
                            .map((item) => item.title)}
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
