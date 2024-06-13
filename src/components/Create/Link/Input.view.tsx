'use client'

import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useState, useEffect, useContext } from 'react'
import { useCreateLink } from '../useCreateLink'

import * as _consts from '../Create.consts'
import * as _utils from '../Create.utils'
import * as context from '@/context'
import * as utils from '@/utils'
import Loading from '@/components/Global/Loading'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import SafeAppsSDK from '@safe-global/safe-apps-sdk'
export const CreateLinkInputView = ({
    onNext,
    onPrev,
    tokenValue,
    setTokenValue,
    setLinkDetails,
    setPassword,
    setGaslessPayload,
    setGaslessPayloadMessage,
    setPreparedDepositTxs,
    setTransactionType,
    setTransactionCostUSD,
    setFeeOptions,
    setEstimatedPoints,
    attachmentOptions,
    setAttachmentOptions,
    createType,
    recipient,
    walletType,
}: _consts.ICreateScreenProps) => {
    const {
        generateLinkDetails,
        assertValues,
        generatePassword,
        makeGaslessDepositPayload,
        prepareDepositTxs,
        switchNetwork,
        estimateGasFee,
        estimatePoints,
        prepareDirectSendTx,
    } = useCreateLink()
    const { selectedTokenPrice, inputDenomination, selectedChainID, selectedTokenAddress } = useContext(
        context.tokenSelectorContext
    )
    const sdk = new SafeAppsSDK()

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()

    const handleConnectWallet = async () => {
        open()
    }

    const handleOnNext = async () => {
        try {
            if (isLoading || (isConnected && !tokenValue)) return

            setLoadingState('Loading')

            setErrorState({
                showError: false,
                errorMessage: '',
            })

            let value: string = tokenValue ?? ''
            if (inputDenomination === 'USD' && tokenValue && selectedTokenPrice) {
                value = _utils
                    .convertUSDTokenValue({
                        tokenPrice: selectedTokenPrice,
                        tokenValue: Number(tokenValue),
                    })
                    .toString()
            }
            setLoadingState('Asserting values')
            await assertValues({ tokenValue: value })
            setLoadingState('Generating details')

            const envInfo = await sdk.safe.getEnvironmentInfo()
            const linkDetails = generateLinkDetails({
                tokenValue: value,
                envInfo,
                walletType,
            })
            setLinkDetails(linkDetails)

            if (createType !== 'direct') {
                const password = await generatePassword()
                setPassword(password)

                setLoadingState('Preparing transaction')
                if (
                    _utils.isGaslessDepositPossible({
                        chainId: selectedChainID,
                        tokenAddress: selectedTokenAddress,
                    })
                ) {
                    console.log('gasless possible, creating gassles payload')
                    setTransactionType('gasless')

                    const makeGaslessDepositResponse = await makeGaslessDepositPayload({
                        _linkDetails: linkDetails,
                        _password: password,
                    })

                    if (
                        !makeGaslessDepositResponse ||
                        !makeGaslessDepositResponse.payload ||
                        !makeGaslessDepositResponse.message
                    )
                        return
                    setGaslessPayload(makeGaslessDepositResponse.payload)
                    setGaslessPayloadMessage(makeGaslessDepositResponse.message)

                    setFeeOptions(0)
                    setTransactionCostUSD(0)
                } else {
                    console.log('gasless not possible, creating normal payload')
                    setTransactionType('not-gasless')

                    const prepareDepositTxsResponse = await prepareDepositTxs({
                        _linkDetails: linkDetails,
                        _password: password,
                    })

                    console.log('prepareDepositTxsResponse', prepareDepositTxsResponse)
                    setPreparedDepositTxs(prepareDepositTxsResponse)

                    try {
                        console.log(prepareDepositTxsResponse?.unsignedTxs[0])
                        const { feeOptions, transactionCostUSD } = await estimateGasFee({
                            chainId: selectedChainID,
                            preparedTx: prepareDepositTxsResponse?.unsignedTxs[0],
                        })

                        const USDValue = Number(tokenValue) * (selectedTokenPrice ?? 0)
                        const estimatedPoints = await estimatePoints({
                            chainId: selectedChainID,
                            address: address ?? '',
                            amountUSD: USDValue,
                            preparedTx:
                                prepareDepositTxsResponse?.unsignedTxs[
                                    prepareDepositTxsResponse?.unsignedTxs.length - 1
                                ],
                        })

                        if (estimatedPoints) setEstimatedPoints(estimatedPoints)

                        setFeeOptions(feeOptions)
                        setTransactionCostUSD(transactionCostUSD)
                    } catch (error) {
                        console.error(error)
                        setFeeOptions(undefined)
                        setTransactionCostUSD(undefined)
                    }
                }

                await switchNetwork(selectedChainID)

                onNext()
            } else {
                const preparedTxs: interfaces.IPrepareDepositTxsResponse = {
                    unsignedTxs: [
                        {
                            ...prepareDirectSendTx({
                                tokenValue: value,
                                recipient: recipient.address ?? '',
                                tokenAddress: selectedTokenAddress,
                                tokenDecimals: linkDetails.tokenDecimals,
                            }),
                        },
                    ],
                }

                console.log('preparedTxs', preparedTxs)

                setPreparedDepositTxs(preparedTxs)

                try {
                    const { feeOptions, transactionCostUSD } = await estimateGasFee({
                        chainId: selectedChainID,
                        preparedTx: preparedTxs?.unsignedTxs[0],
                    })
                    setFeeOptions(feeOptions)
                    setTransactionCostUSD(transactionCostUSD)
                    setEstimatedPoints(0)
                } catch (error) {
                    console.error(error)
                    setFeeOptions(undefined)
                    setTransactionCostUSD(undefined)
                }

                await switchNetwork(selectedChainID)
                onNext()
            }
        } catch (error) {
            const errorString = utils.ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label
                className="max-h-[92px] w-full overflow-hidden text-h2"
                style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}
            >
                {createType === 'link'
                    ? 'Send crypto via link'
                    : createType === 'direct'
                      ? `Send to ${recipient.name?.endsWith('.eth') ? recipient.name : utils.shortenAddressLong(recipient.address ?? '')}`
                      : `Send to ${recipient.name}`}
            </label>
            <label className="max-w-96 text-start text-h8 font-light">
                {createType === 'link' &&
                    'Deposit some crypto to the link, no need for wallet addresses. Send the link to the recipient. They will be able to claim the funds in any token on any chain from the link.'}
                {createType === 'email_link' &&
                    `You will send an email to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                {createType === 'sms_link' &&
                    `You will send a text message to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                {createType === 'direct' &&
                    `You will do a direct blockchain transaction to ${recipient.name ?? recipient.address}. Ensure the recipient address is correct, else the funds might be lost.`}
            </label>
            <div className="flex w-full flex-col items-center justify-center gap-3">
                <TokenAmountInput
                    className="w-full"
                    tokenValue={tokenValue}
                    setTokenValue={setTokenValue}
                    onSubmit={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                />
                <TokenSelector classNameButton="w-full" />
                {(createType === 'link' || createType === 'email_link' || createType === 'sms_link') && (
                    <FileUploadInput
                        attachmentOptions={attachmentOptions}
                        setAttachmentOptions={setAttachmentOptions}
                    />
                )}
            </div>
            <div className="flex w-full flex-col items-center justify-center gap-3">
                <button
                    className="wc-disable-mf btn-purple btn-xl "
                    onClick={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                    disabled={isLoading || (isConnected && !tokenValue)}
                >
                    {!isConnected ? (
                        'Connect Wallet'
                    ) : isLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : (
                        'Confirm'
                    )}
                </button>
                <button className="btn btn-xl" onClick={onPrev} disabled={isLoading}>
                    Return
                </button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
