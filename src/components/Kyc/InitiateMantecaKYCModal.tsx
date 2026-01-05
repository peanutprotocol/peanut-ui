'use client'

import ActionModal from '@/components/Global/ActionModal'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { type CountryData } from '@/components/AddMoney/consts'
import { Button } from '@/components/0_Bruddle/Button'
import { PeanutDoesntStoreAnyPersonalInformation } from './KycVerificationInProgressModal'
import { useEffect } from 'react'

interface Props {
    isOpen: boolean
    onClose: () => void
    onKycSuccess?: () => void
    onManualClose?: () => void
    country: CountryData
    title?: string | React.ReactNode
    description?: string | React.ReactNode
    ctaText?: string
    footer?: React.ReactNode
    autoStartKyc?: boolean
}

const InitiateMantecaKYCModal = ({
    isOpen,
    onClose,
    onKycSuccess,
    onManualClose,
    country,
    title,
    description,
    ctaText,
    footer,
    autoStartKyc,
}: Props) => {
    const { isLoading, iframeOptions, openMantecaKyc, handleIframeClose } = useMantecaKycFlow({
        onClose: onManualClose, // any non-success close from iframe is a manual close in case of Manteca KYC
        onSuccess: onKycSuccess,
        onManualClose,
        country,
    })

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.source === 'peanut-kyc-success') {
                onKycSuccess?.()
            }
        }

        window.addEventListener('message', handleMessage)

        return () => {
            window.removeEventListener('message', handleMessage)
        }
    }, [])

    useEffect(() => {
        if (autoStartKyc) {
            openMantecaKyc(country)
        }
    }, [autoStartKyc])

    const isAutoStarting = autoStartKyc && isLoading
    const displayTitle = isAutoStarting ? 'Starting verification...' : (title ?? 'Verify your identity first')
    const displayDescription = isAutoStarting
        ? 'Please wait while we start your verification...'
        : (description ??
          'To continue, you need to complete identity verification. This usually takes just a few minutes.')

    return (
        <>
            <ActionModal
                visible={isOpen && !iframeOptions.visible}
                onClose={onClose}
                title={displayTitle}
                description={displayDescription}
                icon={'badge' as IconName}
                modalPanelClassName="max-w-full m-4"
                ctaClassName="grid grid-cols-1 gap-3"
                ctas={[
                    {
                        text: isLoading ? 'Loading...' : (ctaText ?? 'Verify now'),
                        onClick: () => openMantecaKyc(country),
                        variant: 'purple',
                        disabled: isLoading,
                        shadowSize: '4',
                        icon: 'check-circle',
                        className: 'h-11',
                    },
                ]}
                footer={footer}
            />
            <IframeWrapper {...iframeOptions} onClose={handleIframeClose} />
        </>
    )
}

export const MantecaGeoSpecificKycModal = ({
    isUserBridgeKycApproved,
    selectedCountry,
    setIsMantecaModalOpen,
    isMantecaModalOpen,
    onKycSuccess,
    onClose,
    onManualClose,
}: {
    isUserBridgeKycApproved: boolean
    selectedCountry: { id: string; title: string }
    setIsMantecaModalOpen: (isOpen: boolean) => void
    isMantecaModalOpen: boolean
    onKycSuccess: () => void
    onClose?: () => void
    onManualClose?: () => void
}) => {
    return (
        <InitiateMantecaKYCModal
            autoStartKyc={!isUserBridgeKycApproved}
            title={isUserBridgeKycApproved ? `${selectedCountry.title} check required` : 'Verify your identity'}
            description={
                isUserBridgeKycApproved ? (
                    <p>
                        You're already verified in Europe, USA, and Mexico, but to use features in{' '}
                        {selectedCountry.title} you need to complete a separate verification. <br /> Since{' '}
                        <b>we don't keep personal data</b>, your previous KYC can't be reused.
                    </p>
                ) : (
                    <p>
                        Verify your identity to start using features like Mercado Pago payments in{' '}
                        {selectedCountry.title}.{' '}
                    </p>
                )
            }
            footer={
                isUserBridgeKycApproved ? (
                    <Button
                        variant="transparent"
                        className="h-6 p-0 pt-2 text-xs underline"
                        onClick={() => setIsMantecaModalOpen(false)}
                    >
                        Not now
                    </Button>
                ) : (
                    <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
                )
            }
            ctaText="Start Verification"
            isOpen={isMantecaModalOpen}
            onClose={() => {
                setIsMantecaModalOpen(false)
                onClose?.()
            }}
            onKycSuccess={() => {
                setIsMantecaModalOpen(false)
                onKycSuccess?.()
            }}
            onManualClose={() => {
                setIsMantecaModalOpen(false)
                onManualClose?.()
            }}
            country={{ id: selectedCountry.id, title: selectedCountry.title, type: 'country', path: '' }}
        />
    )
}
