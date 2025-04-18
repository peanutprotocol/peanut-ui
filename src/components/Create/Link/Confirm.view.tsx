'use client'
import { useContext, useMemo, useState } from 'react'

import { Button, Card } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import ConfirmDetails from '@/components/Global/ConfirmDetails/Index'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import InfoRow from '@/components/Global/InfoRow'
import PeanutSponsored from '@/components/Global/PeanutSponsored'
import { peanutTokenDetails, supportedPeanutChains } from '@/constants'
import * as context from '@/context'
import { useWalletType } from '@/hooks/useWalletType'
import { useWallet } from '@/hooks/wallet/useWallet'
import {
    areEvmAddressesEqual,
    ErrorHandler,
    formatTokenAmount,
    saveCreatedLinkToLocalStorage,
    saveDirectSendToLocalStorage,
    shareToEmail,
    shareToSms,
    updateUserPreferences,
    validateEnsName,
} from '@/utils'
import * as Sentry from '@sentry/nextjs'
import * as _consts from '../Create.consts'
import { useCreateLink } from '../useCreateLink'

export const CreateLinkConfirmView = ({
    onNext,
    onPrev,
    transactionType,
    preparedDepositTxs,
    gaslessPayload,
    gaslessPayloadMessage,
    linkDetails,
    password,
    setTxHash,
    setLink,
    tokenValue,
    transactionCostUSD,
    feeOptions,
    estimatedPoints,
    attachmentOptions,
    createType = 'link', // note: default to link view temporarily
    recipient,
    crossChainDetails,
    usdValue,
}: _consts.ICreateScreenProps) => {
    const [showMessage, setShowMessage] = useState(false)
    const {
        selectedChainID,
        selectedTokenAddress,
        selectedTokenPrice,
        selectedTokenDecimals,
        supportedSquidChainsAndTokens,
    } = useContext(context.tokenSelectorContext)

    const { walletType } = useWalletType()

    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const {
        sendTransactions,
        signTypedData,
        makeDepositGasless,
        getLinkFromHash,
        submitClaimLinkInit,
        submitClaimLinkConfirm,
        submitDirectTransfer,
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
        const now = new Date().getTime()
        console.log(`Starting at ${now}ms`)
        setLoadingState('Loading')

        setErrorState({
            showError: false,
            errorMessage: '',
        })

        try {
            let hash: string = ''
            let fileUrl = ''
            if (createType != 'direct') {
                console.log(`Submitting claim link init at ${new Date().getTime() - now}ms`)
                const data = await submitClaimLinkInit({
                    password: password ?? '',
                    attachmentOptions: {
                        attachmentFile: attachmentOptions.rawFile,
                        message: attachmentOptions.message,
                    },
                    senderAddress: address ?? '',
                })
                console.log(`Claim link init response at ${new Date().getTime() - now}ms`)
                fileUrl = data?.fileUrl
            }

            //  TODO: create typing enum for transactionType
            if (transactionType === 'not-gasless') {
                // this flow is followed for paying-gas txs, paying-gas userops AND
                // gasless userops (what would be gasless as a tax) via Input.view.tsx which
                // makes userops 'not-gasless' in the sense that we don't want
                // Peanut's BE to make it gasless. The paymaster will make it by default
                // once submitted, but as far as this flow is concerned, the userop is 'not-gasless'
                if (!preparedDepositTxs) return
                console.log(`Sending not-gasless transaction at ${new Date().getTime() - now}ms`)
                hash =
                    (await sendTransactions({ preparedDepositTxs: preparedDepositTxs, feeOptions: feeOptions })) ?? ''
                console.log(`Not-gasless transaction response at ${new Date().getTime() - now}ms`)
            } else {
                if (!gaslessPayload || !gaslessPayloadMessage) return
                setLoadingState('Sign in wallet')
                console.log(`Signing in wallet at ${new Date().getTime() - now}ms`)
                const signature = await signTypedData({ gaslessMessage: gaslessPayloadMessage })
                console.log(`Signing in wallet response at ${new Date().getTime() - now}ms`)
                if (!signature) return
                setLoadingState('Executing transaction')
                console.log(`Executing transaction at ${new Date().getTime() - now}ms`)
                hash = await makeDepositGasless({ signature, payload: gaslessPayload })
                console.log(`Executing transaction response at ${new Date().getTime() - now}ms`)
            }

            setTxHash(hash)

            setLoadingState('Creating link')

            if (createType === 'direct') {
                saveDirectSendToLocalStorage({
                    address: address ?? '',
                    data: {
                        chainId: selectedChainID,
                        tokenAddress: selectedTokenAddress,
                        tokenAmount: tokenValue ?? '0',
                        date: new Date().toISOString(),
                        points: estimatedPoints ?? 0,
                        txHash: hash,
                    },
                })

                await submitDirectTransfer({
                    txHash: hash,
                    chainId: selectedChainID,
                    senderAddress: address ?? '',
                    amountUsd: parseFloat(usdValue ?? '0'),
                    transaction: preparedDepositTxs && preparedDepositTxs.unsignedTxs[0],
                })
            } else {
                console.log(`Getting link from hash at ${new Date().getTime() - now}ms`)
                const link = await getLinkFromHash({ hash, linkDetails, password, walletType })
                console.log(`Getting link from hash response at ${new Date().getTime() - now}ms`)

                saveCreatedLinkToLocalStorage({
                    address: address ?? '',
                    data: {
                        link: link[0],
                        depositDate: new Date().toISOString(),
                        USDTokenPrice: selectedTokenPrice ?? 0,
                        points: estimatedPoints ?? 0,
                        txHash: hash,
                        message: attachmentOptions.message ?? '',
                        attachmentUrl: fileUrl,
                        ...linkDetails,
                    },
                })

                setLink(link)
                console.log(`Submitting claim link confirm at ${new Date().getTime() - now}ms`)
                await submitClaimLinkConfirm({
                    chainId: selectedChainID,
                    link,
                    password: password ?? '',
                    txHash: hash,
                    senderAddress: address ?? '',
                    amountUsd: parseFloat(usdValue ?? '0'),
                    transaction:
                        transactionType === 'not-gasless'
                            ? preparedDepositTxs && preparedDepositTxs.unsignedTxs[0]
                            : undefined,
                })
                console.log(`Submitting claim link confirm response at ${new Date().getTime() - now}ms`)

                if (createType === 'email_link') shareToEmail(recipient.name ?? '', link, usdValue)
                if (createType === 'sms_link') shareToSms(recipient.name ?? '', link, usdValue)
            }

            if (selectedChainID && selectedTokenAddress && selectedTokenDecimals) {
                updateUserPreferences({
                    lastUsedToken: {
                        chainId: selectedChainID,
                        address: selectedTokenAddress,
                        decimals: selectedTokenDecimals,
                    },
                })
            }

            console.log(`Finished at ${new Date().getTime() - now}ms`)
            onNext()
            refetchBalances(address ?? '')
        } catch (error) {
            const errorString = ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
            Sentry.captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <>
            <FlowHeader onPrev={onPrev} disableBackBtn={isLoading} disableWalletHeader />

            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header>
                    <Card.Title style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}>
                        {createType == 'link'
                            ? 'Send to Anyone'
                            : createType == 'direct'
                              ? `Send to ${validateEnsName(recipient.name) ? recipient.name : <AddressLink address={recipient.address ?? ''} />}`
                              : `Send to ${recipient.name}`}
                    </Card.Title>
                    <Card.Description>
                        {/* TODO: use addresslink */}
                        {createType === 'link' &&
                            'Make a payment with the link. Send the link to the recipient. They will be able to claim the funds in any token on any chain from the link.'}
                        {createType === 'email_link' &&
                            `You will send an email to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                        {createType === 'sms_link' &&
                            `You will send a text message to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                        {createType === 'direct' &&
                            `You will send the tokens directly to ${
                                recipient.name ?? <AddressLink address={recipient.address ?? ''} />
                            }. Ensure the recipient address is correct, else the funds might be lost.`}
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
                        {transactionCostUSD !== undefined &&
                            (!isPeanutWallet ? (
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
                            ) : (
                                <PeanutSponsored />
                            ))}
                    </div>

                    <div className="my-4 flex flex-col gap-2 sm:flex-row-reverse">
                        <Button loading={isLoading} onClick={handleConfirm} disabled={isLoading}>
                            {isLoading ? loadingState : 'Confirm'}
                        </Button>
                    </div>
                    {errorState.showError && (
                        <div className="text-start">
                            <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                        </div>
                    )}
                    {!crossChainDetails.find(
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
