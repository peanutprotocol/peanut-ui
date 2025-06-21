import { Button, ButtonProps } from '@/components/0_Bruddle/Button'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { useKycFlow } from '@/hooks/useKycFlow'

// this component is the main entry point for the kyc flow
// it renders a button that, when clicked, initiates the process of fetching
// tos/kyc links, showing them in an iframe, and then displaying a status modal
export const KycFlow = (props: ButtonProps) => {
    const { isLoading, error, iframeOptions, handleInitiateKyc, handleIframeClose } = useKycFlow()

    return (
        <>
            <Button onClick={handleInitiateKyc} disabled={isLoading} {...props}>
                {isLoading ? 'Loading...' : (props.children ?? 'Start Verification')}
            </Button>

            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

            <IframeWrapper {...iframeOptions} onClose={handleIframeClose} />
        </>
    )
}
