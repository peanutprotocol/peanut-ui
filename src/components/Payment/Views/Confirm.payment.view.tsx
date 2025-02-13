'use client'

import { Button } from '@/components/0_Bruddle'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import { supportedPeanutChains } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ITokenPriceData } from '@/interfaces'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { RequestCharge } from '@/services/services.types'
import { fetchTokenPrice, getChainName } from '@/utils'
import { useSearchParams } from 'next/navigation'
import { useContext, useEffect, useMemo, useState } from 'react'

export default function ConfirmPaymentView() {
    const dispatch = useAppDispatch()
    const [showMessage, setShowMessage] = useState<boolean>(false)
    const { isConnected } = useWallet()
    const { attachmentOptions, urlParams } = usePaymentStore()
    const { selectedChainID, selectedTokenData } = useContext(tokenSelectorContext)
    const searchParams = useSearchParams()
    const chargeId = searchParams.get('chargeId')
    const [charge, setCharge] = useState<RequestCharge | null>(null)
    const [tokenPriceData, setTokenPriceData] = useState<ITokenPriceData | undefined>(undefined)
    const [error, setError] = useState<string>('')
    const [isLoading, setIsLoading] = useState<boolean>(false)

    // determine if all params are present in the URL
    const isDirectUrlAccess = useMemo(() => {
        return urlParams && urlParams.recipient && urlParams.amount && urlParams.token && urlParams.chain
    }, [urlParams])

    // Get selected chain details
    const selectedChain = supportedPeanutChains.find((chain) => chain.chainId.toString() === selectedChainID)

    // call charges service to get charge details
    useEffect(() => {
        if (chargeId) {
            chargesApi
                .get(chargeId)
                .then((charge) => {
                    setCharge(charge)
                    dispatch(paymentActions.setRequestDetails(charge))
                })
                .catch((error) => {
                    setError(error.message)
                })
        }
    }, [chargeId, dispatch])

    useEffect(() => {
        if (!charge) return

        fetchTokenPrice(charge.tokenAddress.toLowerCase(), charge.chainId).then((tokenPriceData) => {
            if (tokenPriceData) {
                setTokenPriceData(tokenPriceData)
            } else {
                setError('Failed to fetch token price')
            }
        })
    }, [charge])

    // todo: add better loading state
    if (!charge) return <div>Loading...</div>

    return (
        <div className="space-y-4">
            {!isDirectUrlAccess && (
                <FlowHeader onPrev={() => dispatch(paymentActions.setView(1))} disableWalletHeader />
            )}

            <div className="pb-1 text-start text-h4 font-bold">Confirm Details</div>
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <div className="text-sm font-semibold text-grey-1">Recipient</div>
                    </div>
                    <div className="font-semibold">{urlParams?.recipient || charge?.requestLink?.recipientAddress}</div>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <div className="text-sm font-semibold text-grey-1">Amount</div>
                    </div>
                    <div className="font-semibold">{urlParams?.amount || charge?.tokenAmount}</div>
                </div>

                {/* URL Parameters Section */}
                {urlParams?.chain && (
                    <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                        <div className="text-sm font-semibold text-grey-1">Destination Chain</div>
                        <div className="font-semibold capitalize">{urlParams.chain}</div>
                    </div>
                )}

                {urlParams?.token && (
                    <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                        <div className="text-sm font-semibold text-grey-1">Destination Token</div>
                        <div className="font-semibold uppercase">{urlParams.token}</div>
                    </div>
                )}

                {/* only show if the user is not accessing the payment directly via URL */}
                {!isDirectUrlAccess && selectedChainID && selectedTokenData && (
                    <>
                        <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                            <div className="text-sm font-semibold text-grey-1">Payment Chain</div>
                            <div className="font-semibold capitalize">{getChainName(selectedChainID)}</div>
                        </div>

                        <div className="flex items-center justify-between border-b border-dashed border-black pb-2">
                            <div className="text-sm font-semibold text-grey-1">Payment Token</div>
                            <div className="font-semibold uppercase">{selectedTokenData.symbol}</div>
                        </div>
                    </>
                )}

                {attachmentOptions.fileUrl && (
                    <div className="flex w-full flex-col items-center justify-center gap-1 border-b border-dashed border-black pb-2">
                        <div className="flex w-full cursor-pointer flex-row items-center justify-between gap-1 text-h8 text-grey-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'paperclip'} className="h-4 fill-grey-1" />
                                <div className="text-sm font-semibold text-grey-1">Attachment</div>
                            </div>
                            <a
                                href={attachmentOptions.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-start text-sm font-semibold leading-4 hover:underline"
                            >
                                <span>Download </span>
                                <Icon name={'download'} className="h-4 fill-grey-1" />
                            </a>
                        </div>
                    </div>
                )}

                {attachmentOptions?.message && (
                    <div
                        onClick={() => setShowMessage(!showMessage)}
                        className="flex w-full flex-col items-center justify-center gap-1 border-b border-dashed border-black pb-2"
                    >
                        <div className="flex w-full cursor-pointer flex-row items-center justify-between gap-1 text-h8 text-grey-1">
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'email'} className="h-4 fill-grey-1" />
                                <div className="text-sm font-semibold text-grey-1">Message</div>
                            </div>
                            <Icon
                                name={'arrow-bottom'}
                                className={`h-4 cursor-pointer fill-grey-1 transition-transform ${showMessage && 'rotate-180'}`}
                            />
                        </div>

                        {showMessage && (
                            <div className="flex w-full flex-col items-center justify-center gap-1 py-1 text-h8 text-grey-1">
                                <div className="w-full text-start text-sm font-normal leading-4">
                                    {attachmentOptions.message}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="text-xs">
                Please confirm all the details before sending the payment, you can edit the details by clicking on the
                back button on the top left corner.
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row-reverse">
                <Button onClick={() => {}} disabled={!isConnected || isLoading} className="w-full">
                    {!isConnected ? 'Connect Wallet' : 'Confirm'}
                </Button>
            </div>

            {error && <div className="text-red-500">{error}</div>}

            {/* todo: add error state */}
        </div>
    )
}
