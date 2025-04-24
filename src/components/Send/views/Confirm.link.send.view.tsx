'use client'
import { useContext, useMemo, useState } from 'react'

import { Button, Card } from '@/components/0_Bruddle'
import ConfirmDetails from '@/components/Global/ConfirmDetails/Index'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import InfoRow from '@/components/Global/InfoRow'
import { LoadingStates, peanutTokenDetails, supportedPeanutChains } from '@/constants'
import * as context from '@/context'
import { useWalletType } from '@/hooks/useWalletType'
import { useWallet } from '@/hooks/wallet/useWallet'
import { areEvmAddressesEqual, ErrorHandler, formatTokenAmount } from '@/utils'

import { useCreateLink } from '@/components/Create/useCreateLink'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { captureException } from '@sentry/nextjs'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { createAndProcessLink } from '../utils/createLinkUtils'

const LinkSendConfirmView = () => {
    const dispatch = useAppDispatch()
    const {
        transactionType,
        preparedDepositTxs,
        gaslessPayload,
        gaslessPayloadMessage,
        linkDetails,
        password,
        tokenValue,
        transactionCostUSD,
        feeOptions,
        estimatedPoints,
        attachmentOptions,
        crossChainDetails,
        usdValue,
        errorState,
    } = useSendFlowStore()

    const [showMessage, setShowMessage] = useState(false)
    const {
        selectedChainID,
        selectedTokenAddress,
        selectedTokenPrice,
        selectedTokenDecimals,
        supportedSquidChainsAndTokens,
    } = useContext(context.tokenSelectorContext)

    const { walletType } = useWalletType()

    const {
        sendTransactions,
        signTypedData,
        makeDepositGasless,
        getLinkFromHash,
        submitClaimLinkInit,
        submitClaimLinkConfirm,
    } = useCreateLink()
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)

    const { address, refetchBalances, isPeanutWallet } = useWallet()

    const selectedChain = useMemo(() => {
        if (supportedSquidChainsAndTokens[selectedChainID]) {
            const chain = supportedSquidChainsAndTokens[selectedChainID]
            return {
                name: chain.axelarChainName,
                iconUri: chain.chainIconURI,
            }
        } else {
            const chain = supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)
            return {
                name: chain?.name,
                iconUri: chain?.icon.url,
            }
        }
    }, [supportedSquidChainsAndTokens, selectedChainID])

    const selectedToken = useMemo(() => {
        if (supportedSquidChainsAndTokens[selectedChainID]) {
            const chain = supportedSquidChainsAndTokens[selectedChainID]
            const token = chain.tokens.find((token) => areEvmAddressesEqual(token.address, selectedTokenAddress))
            return {
                symbol: token?.symbol,
                iconUri: token?.logoURI,
            }
        } else {
            const token = peanutTokenDetails
                .find((tokenDetails) => tokenDetails.chainId === selectedChainID)
                ?.tokens.find((token) => areEvmAddressesEqual(token.address, selectedTokenAddress))
            return {
                symbol: token?.symbol,
                iconUri: token?.logoURI,
            }
        }
    }, [selectedChainID, selectedTokenAddress, supportedSquidChainsAndTokens])

    const handleConfirm = async () => {
        try {
            await createAndProcessLink({
                transactionType: transactionType as 'gasless' | 'not-gasless',
                preparedDepositTxs: preparedDepositTxs as peanutInterfaces.IPrepareDepositTxsResponse | undefined,
                gaslessPayload: gaslessPayload as peanutInterfaces.IGaslessDepositPayload | undefined,
                gaslessPayloadMessage: gaslessPayloadMessage as peanutInterfaces.IPreparedEIP712Message | undefined,
                linkDetails: linkDetails as peanutInterfaces.IPeanutLinkDetails | undefined,
                password,
                attachmentOptions: attachmentOptions || { rawFile: undefined, message: undefined, fileUrl: undefined },
                address,
                selectedChainID,
                usdValue,
                selectedTokenPrice,
                estimatedPoints,
                selectedTokenAddress,
                selectedTokenDecimals,
                feeOptions,
                sendTransactions: async ({ preparedDepositTxs, feeOptions }) => {
                    return (await sendTransactions({ preparedDepositTxs, feeOptions })) || ''
                },
                signTypedData: async ({ gaslessMessage }) => {
                    return await signTypedData({ gaslessMessage })
                },
                // todo: with zeroDev we dont need makeDepositGasless anymore, refactor this in future -- https://github.com/peanutprotocol/peanut-ui/pull/796/files#r2056607581
                makeDepositGasless: async ({ signature, payload }) => {
                    return await makeDepositGasless({ signature, payload })
                },
                getLinkFromHash: async ({ hash, linkDetails, password, walletType }) => {
                    return await getLinkFromHash({
                        hash,
                        linkDetails,
                        password,
                        walletType: walletType as 'blockscout',
                    })
                },
                submitClaimLinkInit: async ({ password, attachmentOptions, senderAddress }) => {
                    return await submitClaimLinkInit({ password, attachmentOptions, senderAddress })
                },
                submitClaimLinkConfirm,
                walletType: walletType as 'blockscout' | undefined,
                refetchBalances: (address) => refetchBalances(address),
                dispatch,
                setLoadingState: (state) => setLoadingState(state as LoadingStates),
            })
        } catch (error) {
            const errorString = ErrorHandler(error)
            dispatch(
                sendFlowActions.setErrorState({
                    showError: true,
                    errorMessage: errorString,
                })
            )
            captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <>
            <FlowHeader
                onPrev={() => dispatch(sendFlowActions.setView('INITIAL'))}
                disableBackBtn={isLoading}
                disableWalletHeader
            />

            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header>
                    <Card.Title style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}>
                        Send to Anyone
                    </Card.Title>
                    <Card.Description>
                        Make a payment with the link. Send the link to the recipient. They will be able to claim the
                        funds in any token on any chain from the link.
                    </Card.Description>
                </Card.Header>
                <Card.Content className="space-y-3">
                    <div className="flex items-center justify-center">
                        <ConfirmDetails
                            tokenSymbol={selectedToken?.symbol ?? ''}
                            tokenIconUri={selectedToken?.iconUri ?? ''}
                            chainName={selectedChain?.name ?? ''}
                            chainIconUri={selectedChain?.iconUri ?? ''}
                            tokenAmount={tokenValue ?? '0'}
                            title="You're sending"
                            showOnlyUSD={isPeanutWallet}
                        />
                    </div>

                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        {attachmentOptions.fileUrl && (
                            <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1">
                                <div className="flex w-max flex-row items-center justify-center gap-1">
                                    <Icon name={'paperclip'} className="h-4 fill-grey-1" />
                                    <label className="font-bold">Attachment</label>
                                </div>
                                <a href={attachmentOptions.fileUrl} download target="_blank">
                                    <Icon name={'download'} className="h-4 fill-grey-1" />
                                </a>
                            </div>
                        )}
                        {attachmentOptions.message && (
                            <div className="flex w-full flex-col items-center justify-center gap-1">
                                <div
                                    className="flex w-full  flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1"
                                    onClick={() => {
                                        setShowMessage(!showMessage)
                                    }}
                                >
                                    <div className="flex w-max flex-row items-center justify-center gap-1">
                                        <Icon name={'paperclip'} className="h-4 fill-grey-1 " />
                                        <label className=" font-bold">Message</label>
                                    </div>
                                    <Icon
                                        name={'arrow-bottom'}
                                        className={`h-4 cursor-pointer fill-grey-1 transition-transform ${showMessage && ' rotate-180'}`}
                                    />
                                </div>
                                {showMessage && (
                                    <div className="flex w-full flex-col items-center justify-center gap-1 pl-7 text-h8 text-grey-1">
                                        <label className="w-full text-start text-sm font-normal leading-4">
                                            {attachmentOptions.message}
                                        </label>
                                    </div>
                                )}
                            </div>
                        )}
                        {transactionCostUSD !== undefined && (
                            <InfoRow
                                iconName="gas"
                                label="Network cost"
                                value={
                                    transactionCostUSD < 0.01
                                        ? '$<0.01'
                                        : `$${formatTokenAmount(transactionCostUSD, 3) ?? 0}`
                                }
                                moreInfoText={`This transaction will cost you $${
                                    transactionCostUSD < 0.01
                                        ? '<0.01'
                                        : `${formatTokenAmount(transactionCostUSD, 3) ?? 0}`
                                } in network fees.`}
                            />
                        )}
                    </div>

                    <div className="my-4 flex flex-col gap-2 sm:flex-row-reverse">
                        <Button loading={isLoading} onClick={handleConfirm} disabled={isLoading}>
                            {isLoading ? loadingState : 'Confirm'}
                        </Button>
                    </div>
                    {errorState?.showError && (
                        <div className="text-start">
                            <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                        </div>
                    )}
                    {!crossChainDetails?.find(
                        (chain: any) => chain.chainId.toString() === selectedChainID.toString()
                    ) && (
                        <span className=" text-start text-h8 font-normal">
                            <Icon name="warning" className="-mt-0.5" /> This chain does not support cross-chain
                            claiming.
                        </span>
                    )}
                </Card.Content>
            </Card>
        </>
    )
}

export default LinkSendConfirmView
