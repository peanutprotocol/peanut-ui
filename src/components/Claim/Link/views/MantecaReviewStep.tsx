import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import Card from '@/components/Global/Card'
import { PaymentInfoRow, type PaymentInfoRowProps } from '@/components/Payment/PaymentInfoRow'
import Loading from '@/components/Global/Loading'
import RateUnavailable from '@/components/Global/RateUnavailable'
import { useCurrency } from '@/hooks/useCurrency'
import { mantecaApi } from '@/services/manteca'
import { sendLinksApi } from '@/services/sendLinks'
import { MercadoPagoStep } from '@/types/manteca.types'
import { type Dispatch, type FC, type SetStateAction, useState } from 'react'
import useClaimLink from '@/components/Claim/useClaimLink'
import * as Sentry from '@sentry/nextjs'
import { requireMantecaDepositAddress } from '@/utils/manteca.utils'
import { useTranslations } from 'next-intl'

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
    const t = useTranslations('claim')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { price, isLoading, refetch: refetchCurrency } = useCurrency(currency)
    const { claimLink: claimLinkSecure } = useClaimLink()

    const detailsCardRows: (PaymentInfoRowProps & { key: string })[] = [
        {
            key: 'destinationAddress',
            label: t('manteca.destinationAddress'),
            value: destinationAddress,
            allowCopy: true,
        },
        {
            key: 'exchangeRate',
            label: t('manteca.exchangeRate'),
            value: price?.sell ? `1 USD = ${price.sell} ${currency}` : 'Unavailable',
        },
        {
            key: 'fee',
            label: t('fee'),
            value: tCommon('sponsoredByPeanut'),
            hideBottomBorder: true,
        },
    ]
    const handleWithdraw = async () => {
        if (destinationAddress) {
            try {
                setError(null)
                setIsSubmitting(true)

                // Entity-aware deposit address (per-entity balances from
                // 2026-09-14): ask /withdraw/init where THIS currency's
                // offramp must be funded BEFORE spending the one-shot claim
                // link. This path FAILS CLOSED on any init problem — error,
                // missing field, malformed or zero address — because no funds
                // have moved yet and the user can retry, while claiming to a
                // guessed address and then failing would irreversibly strand
                // the link's funds at the wrong entity. (The signed flows keep
                // a constant fallback because the backend validates their
                // recipient before anything is broadcast; nothing validates a
                // link claim.)
                const { data: initData, error: initError } = await mantecaApi.initiateWithdraw({ amount, currency })
                if (initError) {
                    setError(t('manteca.errors.generic'))
                    return
                }
                const depositAddress = requireMantecaDepositAddress(initData?.depositAddress)
                if (!depositAddress) {
                    setError(t('manteca.errors.generic'))
                    return
                }

                // Use secure SDK claim (password stays client-side, only signature sent to backend)
                const txHash = await claimLinkSecure({
                    address: depositAddress,
                    link: claimLink,
                })

                if (!txHash) {
                    setError(t('manteca.errors.missingTxHash'))
                    return
                }

                // Associate the claim with user if logged in
                // CRITICAL: This is blocking for Manteca because claims to the Manteca deposit address
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
                        setError(t('manteca.errors.withdrawalProcessing'))
                        Sentry.captureException(retryError, {
                            tags: { feature: 'manteca-claim-association-retry-failed' },
                            extra: { txHash, claimLink },
                            level: 'error',
                        })
                        // Continue to withdraw - funds are safe
                    }
                }

                const {
                    data,
                    error: withdrawError,
                    message: withdrawMessage,
                } = await mantecaApi.withdraw({
                    amount,
                    destinationAddress: destinationAddress.toLowerCase(),
                    txHash,
                    currency,
                })
                if (withdrawError || !data) {
                    // handle third-party account error with user-friendly message
                    if (withdrawError === 'TAX_ID_MISMATCH' || withdrawError === 'CUIT_MISMATCH') {
                        setError(t('manteca.ownAccountOnly'))
                    } else {
                        // Prefer the API's human-written message over the raw
                        // wire code — CLAIM_STORE_UNAVAILABLE as literal screen
                        // text helps nobody whose funds already left the link.
                        setError(withdrawMessage || withdrawError || t('manteca.errors.generic'))
                    }
                    return
                }
                setCurrentStep(MercadoPagoStep.SUCCESS)
            } catch (error) {
                setError(error instanceof Error ? error.message : t('manteca.errors.generic'))
                console.error('Error claiming link:', error)
            } finally {
                setIsSubmitting(false)
            }
        }
    }

    if (isLoading) {
        return <Loading variant="mascot" coverFullScreen />
    }

    // Without a rate the exchange row renders "1 USD = undefined", so offer a
    // retry rather than a review screen the user can't act on.
    if (!price) {
        return <RateUnavailable onRetry={refetchCurrency} />
    }

    return (
        <>
            <Card>
                {detailsCardRows.map(({ key, ...row }) => (
                    <PaymentInfoRow key={key} {...row} />
                ))}
            </Card>

            {error && <Notification priority="error">{error}</Notification>}
            <Button disabled={isSubmitting} loading={isSubmitting} shadowSize="4" onClick={handleWithdraw}>
                {tNav('withdraw')}
            </Button>
        </>
    )
}

export default MantecaReviewStep
