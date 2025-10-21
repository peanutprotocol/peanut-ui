import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import MantecaDetailsCard, { type MantecaCardRow } from '@/components/Global/MantecaDetailsCard'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { MANTECA_DEPOSIT_ADDRESS } from '@/constants'
import { useCurrency } from '@/hooks/useCurrency'
import { mantecaApi } from '@/services/manteca'
import { sendLinksApi } from '@/services/sendLinks'
import { MercadoPagoStep } from '@/types/manteca.types'
import { type Dispatch, type FC, type SetStateAction, useState } from 'react'
import useClaimLink from '@/components/Claim/useClaimLink'

interface MantecaReviewStepProps {
    setCurrentStep: Dispatch<SetStateAction<MercadoPagoStep>>
    claimLink: string
    destinationAddress: string
    amount: string
    currency: string
}

const MantecaReviewStep: FC<MantecaReviewStepProps> = ({
    setCurrentStep,
    claimLink,
    destinationAddress,
    amount,
    currency,
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { price, isLoading } = useCurrency(currency)
    const { claimLink: claimLinkSecure } = useClaimLink()

    const detailsCardRows: MantecaCardRow[] = [
        {
            key: 'destinationAddress',
            label: 'Destination Address',
            value: destinationAddress,
            allowCopy: true,
        },
        {
            key: 'exchangeRate',
            label: 'Exchange Rate',
            value: `1 USD = ${price?.buy} ${currency}`,
        },
        {
            key: 'fee',
            label: 'Fee',
            value: 'Sponsored by Peanut',
            hideBottomBorder: true,
        },
    ]
    const handleWithdraw = async () => {
        if (destinationAddress) {
            try {
                setError(null)
                setIsSubmitting(true)

                // Use secure SDK claim (password stays client-side, only signature sent to backend)
                const txHash = await claimLinkSecure({
                    address: MANTECA_DEPOSIT_ADDRESS,
                    link: claimLink,
                })

                if (!txHash) {
                    setError('Claim failed: missing transaction hash.')
                    return
                }

                // Associate the claim with user if logged in
                try {
                    await sendLinksApi.associateClaim(txHash)
                } catch (e) {
                    console.error('Failed to associate claim:', e)
                    // Non-critical, continue
                }

                const { data, error: withdrawError } = await mantecaApi.withdraw({
                    amount: amount.replace(/,/g, ''),
                    destinationAddress,
                    txHash,
                    currency,
                })
                if (withdrawError || !data) {
                    setError(withdrawError || 'Something went wrong. Please contact Support')
                    return
                }
                setCurrentStep(MercadoPagoStep.SUCCESS)
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Something went wrong. Please contact Support')
                console.error('Error claiming link:', error)
            } finally {
                setIsSubmitting(false)
            }
        }
    }

    if (isLoading) {
        return <PeanutLoading coverFullScreen />
    }

    return (
        <>
            <MantecaDetailsCard rows={detailsCardRows} />

            {error && <ErrorAlert description={error} />}
            <Button disabled={isSubmitting} loading={isSubmitting} shadowSize="4" onClick={handleWithdraw}>
                Withdraw
            </Button>
        </>
    )
}

export default MantecaReviewStep
