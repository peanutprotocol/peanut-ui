'use client'

import ActionModal from '@/components/Global/ActionModal'
import IframeWrapper from '@/components/Global/IframeWrapper'
import CameraPermissionWarningModal from './CameraPermissionWarningModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { type CountryData } from '@/components/AddMoney/consts'
import { Button } from '../0_Bruddle'
import { PeanutDoesntStoreAnyPersonalInformation } from './KycVerificationInProgressModal'
import { useEffect } from 'react'
import { useKycCameraCheck } from '@/hooks/useKycCameraCheck'

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
}: Props) => {
    const { isLoading, iframeOptions, openMantecaKyc, handleIframeClose } = useMantecaKycFlow({
        onClose: onManualClose, // any non-success close from iframe is a manual close in case of Manteca KYC
        onSuccess: onKycSuccess,
        onManualClose,
        country,
    })

    const {
        showCameraWarning,
        setShowCameraWarning,
        mediaCheckResult,
        handleVerifyClick,
        handleContinueAnyway,
        handleOpenInBrowser,
        isChecking,
    } = useKycCameraCheck({
        onInitiateKyc: () => openMantecaKyc(country),
        onClose,
    })

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Validate origin for security
            if (!event.origin.includes('manteca')) return

            if (event.data.source === 'peanut-kyc-success') {
                onKycSuccess?.()
            }
        }

        window.addEventListener('message', handleMessage)

        return () => {
            window.removeEventListener('message', handleMessage)
        }
    }, [onKycSuccess])

    return (
        <>
            <ActionModal
                visible={isOpen && !iframeOptions.visible && !showCameraWarning}
                onClose={onClose}
                title={title ?? 'Verify your identity first'}
                description={
                    description ??
                    'To continue, you need to complete identity verification. This usually takes just a few minutes.'
                }
                icon={'badge' as IconName}
                modalPanelClassName="max-w-full m-4"
                ctaClassName="grid grid-cols-1 gap-3"
                ctas={[
                    {
                        text: isLoading || isChecking ? 'Loading...' : (ctaText ?? 'Verify now'),
                        onClick: handleVerifyClick,
                        variant: 'purple',
                        disabled: isLoading || isChecking,
                        shadowSize: '4',
                        icon: 'check-circle',
                        className: 'h-11',
                    },
                ]}
                footer={footer}
            />

            {mediaCheckResult && (
                <CameraPermissionWarningModal
                    visible={showCameraWarning}
                    onClose={() => setShowCameraWarning(false)}
                    onContinueAnyway={handleContinueAnyway}
                    onOpenInBrowser={handleOpenInBrowser}
                    mediaCheckResult={mediaCheckResult}
                />
            )}

            <IframeWrapper
                {...iframeOptions}
                visible={iframeOptions.visible && !showCameraWarning}
                onClose={handleIframeClose}
            />
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
