import ActionModal from '@/components/Global/ActionModal'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { IconName } from '@/components/Global/Icons/Icon'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { CountryData } from '@/components/AddMoney/consts'

interface Props {
    isOpen: boolean
    onClose: () => void
    onKycSuccess?: () => void
    onManualClose?: () => void
    country: CountryData
}

export const InitiateMantecaKYCModal = ({ isOpen, onClose, onKycSuccess, onManualClose, country }: Props) => {
    const { isLoading, iframeOptions, openMantecaKyc, handleIframeClose } = useMantecaKycFlow({
        onClose: onManualClose, // any non-success close from iframe is a manual close in case of Manteca KYC
        onSuccess: onKycSuccess,
        onManualClose,
        country,
    })

    return (
        <>
            <ActionModal
                visible={isOpen && !iframeOptions.visible}
                onClose={onClose}
                title="Verify your identity first"
                description="To continue, you need to complete identity verification. This usually takes just a few minutes."
                icon={'badge' as IconName}
                modalPanelClassName="max-w-full m-2"
                ctaClassName="grid grid-cols-1 gap-3"
                ctas={[
                    {
                        text: isLoading ? 'Loading...' : 'Verify now',
                        onClick: () => openMantecaKyc(country),
                        variant: 'purple',
                        disabled: isLoading,
                        shadowSize: '4',
                        icon: 'check-circle',
                        className: 'h-11',
                    },
                ]}
            />
            <IframeWrapper {...iframeOptions} onClose={handleIframeClose} />
        </>
    )
}
