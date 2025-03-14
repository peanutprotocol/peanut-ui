import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FlowHeader from '@/components/Global/FlowHeader'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { CreateChargeRequest } from '@/services/services.types'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useState } from 'react'
import BeerInput from '../BeerInput'
import PintaReqViewWrapper from '../PintaReqViewWrapper'

const PintaReqPayInitialView = ({ token }: ParsedURL) => {
    const dispatch = useAppDispatch()
    const { beerQuantity, requestDetails, error } = usePaymentStore()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleCreateCharge = async () => {
        if (!requestDetails) return
        setIsSubmitting(true)
        dispatch(paymentActions.setError(null))

        try {
            const createChargeRequestPayload: CreateChargeRequest = {
                pricing_type: 'fixed_price',
                local_price: {
                    // TODO: remove hardcoded amount after testing
                    // using 0.00002 PNT per beer for testing instead of 1 PNT
                    amount: '0.00002',
                    currency: 'USD',
                },
                baseUrl: window.location.origin,
                requestId: requestDetails.uuid,
                requestProps: {
                    chainId: '137',
                    tokenAddress: requestDetails.tokenAddress,
                    tokenType: peanutInterfaces.EPeanutLinkType.erc20,
                    tokenSymbol: 'PNT',
                    tokenDecimals: 10,
                    recipientAddress: requestDetails.recipientAddress,
                },
            }

            const charge = await chargesApi.create(createChargeRequestPayload)

            const newUrl = new URL(window.location.href)
            newUrl.searchParams.set('chargeId', charge.data.id)
            window.history.replaceState(null, '', newUrl.toString())

            dispatch(paymentActions.setCreatedChargeDetails(charge))
            dispatch(paymentActions.setView('CONFIRM'))
        } catch (error: any) {
            console.error('Failed to create charge:', error)
            dispatch(paymentActions.setError(error?.message || 'Failed to create charge'))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div>
            <div className="space-y-4">
                <FlowHeader isPintaReq={token?.symbol === 'PNT'} />

                <PintaReqViewWrapper view="INITIAL">
                    <BeerInput />
                    <Button
                        variant="purple"
                        onClick={handleCreateCharge}
                        disabled={beerQuantity === 0 || isSubmitting}
                        loading={isSubmitting}
                    >
                        {isSubmitting ? 'Creating charge...' : 'Confirm'}
                    </Button>
                    {error && <ErrorAlert description={error} />}
                </PintaReqViewWrapper>
            </div>
        </div>
    )
}

export default PintaReqPayInitialView
