'use client'

import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useState, useContext, useEffect, useMemo } from 'react'
import { useCreateLink } from '../useCreateLink'

import * as _consts from '../Create.consts'
import { isGaslessDepositPossible } from '../Create.utils'
import * as context from '@/context'
import { isNativeCurrency, ErrorHandler, shortenAddressLong, floorFixed } from '@/utils'
import Loading from '@/components/Global/Loading'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import { useWalletType } from '@/hooks/useWalletType'
import { useBalance } from '@/hooks/useBalance'
import { formatEther } from 'viem'

export const CreateLinkInputView = ({
    onNext,
    onPrev,
    tokenValue,
    setTokenValue,
    usdValue,
    setUsdValue,
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
    crossChainDetails,
}: _consts.ICreateScreenProps) => {
    const {
        generateLinkDetails,
        checkUserHasEnoughBalance,
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
    const { walletType, environmentInfo } = useWalletType()
    const { balances, hasFetchedBalances, balanceByToken } = useBalance()

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [_tokenValue, _setTokenValue] = useState<string | undefined>(
        inputDenomination === 'TOKEN' ? tokenValue : usdValue
    )

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
            setLoadingState('Asserting values')
            await checkUserHasEnoughBalance({ tokenValue: tokenValue })

            setLoadingState('Generating details')

            const linkDetails = generateLinkDetails({
                tokenValue: tokenValue,
                envInfo: environmentInfo,
                walletType: walletType,
            })
            setLinkDetails(linkDetails)

            if (createType !== 'direct') {
                const password = await generatePassword()
                setPassword(password)

                setLoadingState('Preparing transaction')

                let prepareDepositTxsResponse: interfaces.IPrepareDepositTxsResponse | undefined
                const _isGaslessDepositPossible = isGaslessDepositPossible({
                    chainId: selectedChainID,
                    tokenAddress: selectedTokenAddress,
                })
                if (_isGaslessDepositPossible) {
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

                    setFeeOptions(undefined)
                    setTransactionCostUSD(0)
                } else {
                    setTransactionType('not-gasless')

                    prepareDepositTxsResponse = await prepareDepositTxs({
                        _linkDetails: linkDetails,
                        _password: password,
                    })

                    setPreparedDepositTxs(prepareDepositTxsResponse)

                    let _feeOptions = undefined

                    try {
                        const { feeOptions, transactionCostUSD } = await estimateGasFee({
                            chainId: selectedChainID,
                            preparedTx: prepareDepositTxsResponse?.unsignedTxs[0],
                        })

                        _feeOptions = feeOptions
                        setFeeOptions(feeOptions)
                        setTransactionCostUSD(transactionCostUSD)
                    } catch (error) {
                        console.error(error)
                        setFeeOptions(undefined)
                        setTransactionCostUSD(undefined)
                    }
                    // If the selected token is native currency, we need to check
                    // the user's balance to ensure they have enough to cover the
                    // gas fees.
                    if (undefined !== _feeOptions && isNativeCurrency(selectedTokenAddress)) {
                        const maxGasAmount = Number(
                            formatEther(_feeOptions.gasLimit.mul(_feeOptions.maxFeePerGas || _feeOptions.gasPrice))
                        )
                        try {
                            await checkUserHasEnoughBalance({
                                tokenValue: String(Number(tokenValue) + maxGasAmount),
                            })
                        } catch (error) {
                            // 6 decimal places, prettier
                            _setTokenValue((Number(tokenValue) - maxGasAmount * 1.3).toFixed(6))
                            setErrorState({
                                showError: true,
                                errorMessage:
                                    'You do not have enough balance to cover the transaction fees, try again with suggested amount',
                            })
                            return
                        }
                    }
                }

                const estimatedPoints = await estimatePoints({
                    chainId: selectedChainID,
                    address: address ?? '',
                    amountUSD: parseFloat(usdValue ?? '0'),
                    preparedTx: _isGaslessDepositPossible
                        ? undefined
                        : prepareDepositTxsResponse &&
                          prepareDepositTxsResponse?.unsignedTxs[prepareDepositTxsResponse?.unsignedTxs.length - 1],
                    actionType: 'CREATE',
                })

                if (estimatedPoints) setEstimatedPoints(estimatedPoints)
                else setEstimatedPoints(0)
            } else {
                const preparedTxs: interfaces.IPrepareDepositTxsResponse = {
                    unsignedTxs: [
                        {
                            ...prepareDirectSendTx({
                                tokenValue: tokenValue ?? '',
                                recipient: recipient.address ?? '',
                                tokenAddress: selectedTokenAddress,
                                tokenDecimals: linkDetails.tokenDecimals,
                            }),
                        },
                    ],
                }

                setPreparedDepositTxs(preparedTxs)

                const estimatedPoints = await estimatePoints({
                    chainId: selectedChainID,
                    address: address ?? '',
                    amountUSD: parseFloat(usdValue ?? '0'),
                    preparedTx: preparedTxs?.unsignedTxs[preparedTxs?.unsignedTxs.length - 1],
                    actionType: 'TRANSFER',
                })

                if (estimatedPoints) setEstimatedPoints(estimatedPoints)
                else setEstimatedPoints(0)
                try {
                    const { feeOptions, transactionCostUSD } = await estimateGasFee({
                        chainId: selectedChainID,
                        preparedTx: preparedTxs?.unsignedTxs[0],
                    })
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
        } catch (error) {
            const errorString = ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    const maxValue = useMemo(() => {
        const balance = balanceByToken(selectedChainID, selectedTokenAddress)
        if (!balance) return ''
        // 6 decimal places, prettier
        return floorFixed(balance.amount, 6)
    }, [selectedChainID, selectedTokenAddress, balanceByToken])

    useEffect(() => {
        if (!_tokenValue) return
        if (inputDenomination === 'TOKEN') {
            setTokenValue(_tokenValue)
            if (selectedTokenPrice) {
                setUsdValue((parseFloat(_tokenValue) * selectedTokenPrice).toString())
            }
        } else if (inputDenomination === 'USD') {
            setUsdValue(_tokenValue)
            if (selectedTokenPrice) {
                setTokenValue((parseFloat(_tokenValue) / selectedTokenPrice).toString())
            }
        }
    }, [_tokenValue, inputDenomination])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <div className="space-y-2">
                <h2
                    className="max-h-[92px] w-full overflow-hidden text-h2"
                    style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}
                >
                    {createType === 'link'
                        ? 'Text Tokens'
                        : createType === 'direct'
                          ? `Send to ${recipient.name?.endsWith('.eth') ? recipient.name : shortenAddressLong(recipient.address ?? '')}`
                          : `Send to ${recipient.name}`}
                </h2>
                <div className="max-w-96 text-center">
                    {createType === 'link' &&
                        'Deposit some crypto to the link, no need for wallet addresses. Send the link to the recipient. They will be able to claim the funds in any token on any chain from the link.'}
                    {createType === 'email_link' &&
                        `You will send an email to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                    {createType === 'sms_link' &&
                        `You will send a text message to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                    {createType === 'direct' &&
                        `You will do a direct blockchain transaction to ${recipient.name ?? recipient.address}. Ensure the recipient address is correct, else the funds might be lost.`}
                </div>
            </div>
            <div className="flex w-full flex-col items-center justify-center gap-3">
                <TokenAmountInput
                    className="w-full"
                    tokenValue={_tokenValue}
                    maxValue={maxValue}
                    setTokenValue={_setTokenValue}
                    onSubmit={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                />
                <TokenSelector classNameButton="w-full" />
                {hasFetchedBalances && balances.length === 0 && (
                    <div
                        onClick={() => {
                            open()
                        }}
                        className="cursor-pointer text-h9 underline"
                    >
                        ( Buy Tokens )
                    </div>
                )}
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
                    Go Back
                </button>
            </div>

            <div className="space-y-2">
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
                {!crossChainDetails.find((chain: any) => chain.chainId.toString() === selectedChainID.toString()) && (
                    <span className=" text-h8 font-normal ">
                        <Icon name="warning" className="-mt-0.5" /> This chain does not support cross-chain claiming.
                    </span>
                )}

                <span className="flex  flex-row items-center justify-center gap-1 text-center text-h8">
                    Learn about peanut cashout
                    <MoreInfo
                        text={
                            'You can use peanut to cash out your funds directly to your bank account! (US and EU only)'
                        }
                    />
                </span>
            </div>
        </div>
    )
}
