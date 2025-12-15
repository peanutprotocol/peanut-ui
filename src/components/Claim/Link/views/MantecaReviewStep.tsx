import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import MantecaDetailsCard, { type MantecaCardRow } from '@/components/Global/MantecaDetailsCard'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useCurrency } from '@/hooks/useCurrency'
import { mantecaApi } from '@/services/manteca'
import { sendLinksApi } from '@/services/sendLinks'
import { MercadoPagoStep } from '@/types/manteca.types'
import { type Dispatch, type FC, type SetStateAction, useState } from 'react'
import useClaimLink from '@/components/Claim/useClaimLink'
import * as Sentry from '@sentry/nextjs'
import { MANTECA_DEPOSIT_ADDRESS } from '@/constants/manteca.consts'

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
                // CRITICAL: This is blocking for Manteca because claims to MANTECA_DEPOSIT_ADDRESS
                // won't appear in history without this association (recipientAddress != user address)
                try {
                    await sendLinksApi.associateClaim(txHash)
                } catch (e) {
                    console.error('Failed to associate claim:', e)
                    Sentry.captureException(e, {
                        tags: { feature: 'manteca-claim-association' },
                        extra: { txHash, claimLink },
                    })

                    // Retry once after 1 second (handles race conditions)
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                    try {
                        await sendLinksApi.associateClaim(txHash)
                    } catch (retryError) {
                        console.error('Failed to associate claim after retry:', retryError)
                        // Show warning but don't block - user's funds are safe
                        setError(
                            'Withdrawal successful! Your funds are being processed. ' +
                                "If the transaction doesn't appear in your history within 5 minutes, please contact support."
                        )
                        Sentry.captureException(retryError, {
                            tags: { feature: 'manteca-claim-association-retry-failed' },
                            extra: { txHash, claimLink },
                            level: 'error',
                        })
                        // Continue to withdraw - funds are safe
                    }
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
