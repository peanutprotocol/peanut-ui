'use client'

import { isGaslessDepositPossible } from '@/components/Create/Create.utils'
import { useCreateLink } from '@/components/Create/useCreateLink'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWalletType } from '@/hooks/useWalletType'
import { useWallet } from '@/hooks/wallet/useWallet'
import { WalletProviderType } from '@/interfaces'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import {
    balanceByToken,
    ErrorHandler,
    floorFixed,
    isNativeCurrency,
    printableUsdc,
    saveCreatedLinkToLocalStorage,
    updateUserPreferences,
} from '@/utils'
import { captureException } from '@sentry/nextjs'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatEther } from 'viem'
import { Button, Card } from '../../0_Bruddle'
import FileUploadInput from '../../Global/FileUploadInput'
import FlowHeader from '../../Global/FlowHeader'
import Icon from '../../Global/Icon'
import MoreInfo from '../../Global/MoreInfo'
import TokenAmountInput from '../../Global/TokenAmountInput'
import TokenSelector from '../../Global/TokenSelector/TokenSelector'

const InitialSendView = () => {
    const dispatch = useAppDispatch()
    const { tokenValue, usdValue, attachmentOptions, crossChainDetails, errorState } = useSendFlowStore()

    const { walletType, environmentInfo } = useWalletType()

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
        sendTransactions,
        signTypedData,
        makeDepositGasless,
        getLinkFromHash,
        submitClaimLinkInit,
        submitClaimLinkConfirm,
        submitDirectTransfer,
        prepareCreateLinkWrapper,
    } = useCreateLink()

    const {
        selectedTokenPrice,
        inputDenomination,
        selectedChainID,
        setSelectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
        selectedTokenData,
    } = useContext(tokenSelectorContext)

    const { setLoadingState, loadingState, isLoading } = useContext(loadingStateContext)

    const [currentInputValue, setCurrentInputValue] = useState<string | undefined>(
        (inputDenomination === 'TOKEN' ? tokenValue : usdValue) ?? ''
    )
    const { selectedWallet, signInModal, isConnected, address, isExternalWallet, isPeanutWallet, refetchBalances } =
        useWallet()

    const maxValue = useMemo(() => {
        if (!selectedWallet?.balances) {
            return selectedWallet?.balance ? printableUsdc(selectedWallet.balance) : ''
        }
        const balance = balanceByToken(selectedWallet.balances, selectedChainID, selectedTokenAddress)
        if (!balance) return ''
        // 6 decimal places, prettier
        return floorFixed(balance.amount, 6)
    }, [selectedChainID, selectedTokenAddress, selectedWallet?.balances, selectedWallet?.balance])

    const handleOnNext = async () => {
        try {
            if (isLoading || (isConnected && !currentInputValue)) return

            setLoadingState('Loading')

            dispatch(
                sendFlowActions.setErrorState({
                    showError: false,
                    errorMessage: '',
                })
            )

            // Important: Set token and USD values in redux before proceeding
            if (inputDenomination === 'TOKEN') {
                dispatch(sendFlowActions.setTokenValue(currentInputValue))
                if (selectedTokenPrice) {
                    dispatch(
                        sendFlowActions.setUsdValue(
                            (parseFloat(currentInputValue ?? '0') * selectedTokenPrice).toString()
                        )
                    )
                }
            } else if (inputDenomination === 'USD') {
                dispatch(sendFlowActions.setUsdValue(currentInputValue))
                if (selectedTokenPrice) {
                    dispatch(
                        sendFlowActions.setTokenValue(
                            (parseFloat(currentInputValue ?? '') / selectedTokenPrice).toString()
                        )
                    )
                }
            }

            // Wait for redux state to update
            await new Promise((resolve) => setTimeout(resolve, 0))

            // Balance checks
            if (isNativeCurrency(selectedTokenAddress)) {
                setLoadingState('Loading')
                const linkDetails = {
                    ...generateLinkDetails({
                        tokenValue: tokenValue,
                        envInfo: environmentInfo,
                        walletType: walletType,
                    }),
                }

                const password = await generatePassword()
                const prepareDepositTxsResponse = await prepareDepositTxs({
                    _linkDetails: linkDetails,
                    _password: password,
                })

                if (prepareDepositTxsResponse) {
                    const { feeOptions } = await estimateGasFee({
                        chainId: selectedChainID,
                        preparedTx: prepareDepositTxsResponse.unsignedTxs[0],
                    })

                    // calculate gas amount in native token
                    const gasLimit = BigInt(feeOptions.gasLimit)
                    const gasPrice = BigInt(feeOptions.maxFeePerGas || feeOptions.gasPrice)
                    const maxGasAmount = Number(formatEther(gasLimit * gasPrice))

                    setLoadingState('Loading')
                    await checkUserHasEnoughBalance({
                        tokenValue: tokenValue!,
                        gasAmount: maxGasAmount,
                    })
                }
            } else {
                setLoadingState('Loading')
                await checkUserHasEnoughBalance({ tokenValue: tokenValue! })
            }

            setLoadingState('Generating details')

            const linkDetails = generateLinkDetails({
                tokenValue: tokenValue,
                envInfo: environmentInfo,
                walletType: walletType,
            })

            dispatch(sendFlowActions.setLinkDetails({ ...linkDetails }))

            const password = await generatePassword()
            dispatch(sendFlowActions.setPassword(password))

            setLoadingState('Preparing transaction')

            // For Peanut wallet users, process the transaction directly
            if (isPeanutWallet) {
                try {
                    // Submit claim link init
                    const data = await submitClaimLinkInit({
                        password: password ?? '',
                        attachmentOptions: {
                            attachmentFile: attachmentOptions.rawFile,
                            message: attachmentOptions.message,
                        },
                        senderAddress: address ?? '',
                    })
                    const fileUrl = data?.fileUrl

                    // Set transaction type to not-gasless for Peanut wallet
                    dispatch(sendFlowActions.setTransactionType('not-gasless'))

                    // Prepare deposit transactions
                    const prepareDepositTxsResponse = await prepareDepositTxs({
                        _linkDetails: linkDetails,
                        _password: password,
                    })

                    if (!prepareDepositTxsResponse) {
                        throw new Error('Failed to prepare deposit transactions')
                    }

                    dispatch(sendFlowActions.setPreparedDepositTxs(prepareDepositTxsResponse))

                    // Send transactions
                    setLoadingState('Executing transaction')
                    const hash =
                        (await sendTransactions({
                            preparedDepositTxs: prepareDepositTxsResponse,
                            feeOptions: undefined,
                        })) ?? ''

                    if (!hash) {
                        throw new Error('Failed to execute transaction')
                    }

                    dispatch(sendFlowActions.setTxHash(hash))

                    // Get link from hash
                    setLoadingState('Creating link')
                    const link = await getLinkFromHash({
                        hash,
                        linkDetails,
                        password,
                        walletType,
                    })

                    if (!link || !link[0]) {
                        throw new Error('Failed to create link')
                    }

                    // Save link to local storage
                    saveCreatedLinkToLocalStorage({
                        address: address ?? '',
                        data: {
                            link: link[0],
                            depositDate: new Date().toISOString(),
                            USDTokenPrice: selectedTokenPrice ?? 0,
                            points: 0,
                            txHash: hash,
                            message: attachmentOptions.message ?? '',
                            attachmentUrl: fileUrl,
                            ...linkDetails,
                        },
                    })

                    dispatch(sendFlowActions.setLink(link[0]))

                    // Submit claim link confirm
                    await submitClaimLinkConfirm({
                        chainId: selectedChainID,
                        link: link[0],
                        password: password ?? '',
                        txHash: hash,
                        senderAddress: address ?? '',
                        amountUsd: parseFloat(usdValue ?? '0'),
                        transaction: prepareDepositTxsResponse.unsignedTxs[0],
                    })

                    // Update user preferences
                    if (selectedChainID && selectedTokenAddress && selectedTokenData?.decimals) {
                        updateUserPreferences({
                            lastUsedToken: {
                                chainId: selectedChainID,
                                address: selectedTokenAddress,
                                decimals: selectedTokenData.decimals,
                            },
                        })
                    }

                    // Refresh balances
                    refetchBalances(address ?? '')

                    // Skip to success view
                    dispatch(sendFlowActions.setView('SUCCESS'))
                    return
                } catch (error) {
                    console.error('Error processing Peanut wallet transaction:', error)
                    const errorString = ErrorHandler(error)
                    dispatch(
                        sendFlowActions.setErrorState({
                            showError: true,
                            errorMessage: errorString,
                        })
                    )
                    captureException(error)
                    setLoadingState('Idle')
                    return
                }
            }

            // For non-Peanut wallets, continue with the normal flow
            let prepareDepositTxsResponse: interfaces.IPrepareDepositTxsResponse | undefined
            const _isGaslessDepositPossible = isGaslessDepositPossible({
                chainId: selectedChainID,
                tokenAddress: selectedTokenAddress,
            })

            if (_isGaslessDepositPossible && selectedWallet?.walletProviderType !== WalletProviderType.PEANUT) {
                // PW userops are marked as 'not-gasless' in this flow, since
                // they will become gasless via the paymaster
                dispatch(sendFlowActions.setTransactionType('gasless'))

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
                dispatch(sendFlowActions.setGaslessPayload(makeGaslessDepositResponse.payload))
                dispatch(sendFlowActions.setGaslessPayloadMessage(makeGaslessDepositResponse.message))

                dispatch(sendFlowActions.setFeeOptions(undefined))
                dispatch(sendFlowActions.setTransactionCostUSD(0))
            } else {
                dispatch(sendFlowActions.setTransactionType('not-gasless'))

                prepareDepositTxsResponse = await prepareDepositTxs({
                    _linkDetails: linkDetails,
                    _password: password,
                })

                dispatch(sendFlowActions.setPreparedDepositTxs(prepareDepositTxsResponse))

                let _feeOptions = undefined

                try {
                    const { feeOptions, transactionCostUSD } = await estimateGasFee({
                        chainId: selectedChainID,
                        preparedTx: prepareDepositTxsResponse?.unsignedTxs[0],
                    })

                    _feeOptions = feeOptions
                    dispatch(sendFlowActions.setFeeOptions(feeOptions))
                    dispatch(sendFlowActions.setTransactionCostUSD(transactionCostUSD))
                } catch (error) {
                    console.error(error)
                    dispatch(sendFlowActions.setFeeOptions(undefined))
                    dispatch(sendFlowActions.setTransactionCostUSD(undefined))
                    captureException(error)
                }
            }

            // Estimate points
            const estimatedPoints = await estimatePoints({
                chainId: selectedChainID,
                address: address ?? '',
                amountUSD: parseFloat(usdValue ?? '0'),
                preparedTx: _isGaslessDepositPossible
                    ? undefined
                    : prepareDepositTxsResponse?.unsignedTxs[prepareDepositTxsResponse?.unsignedTxs.length - 1],
                actionType: 'CREATE',
            })

            if (estimatedPoints) dispatch(sendFlowActions.setEstimatedPoints(estimatedPoints))
            else dispatch(sendFlowActions.setEstimatedPoints(0))

            await switchNetwork(selectedChainID)

            // For non-Peanut wallets, continue to confirm view
            dispatch(sendFlowActions.setView('CONFIRM'))
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

    // Add useEffect to handle input value changes
    useEffect(() => {
        if (!currentInputValue) return
        if (inputDenomination === 'TOKEN') {
            dispatch(sendFlowActions.setTokenValue(currentInputValue))
            if (selectedTokenPrice) {
                dispatch(sendFlowActions.setUsdValue((parseFloat(currentInputValue) * selectedTokenPrice).toString()))
            }
        } else if (inputDenomination === 'USD') {
            dispatch(sendFlowActions.setUsdValue(currentInputValue))
            if (selectedTokenPrice) {
                dispatch(sendFlowActions.setTokenValue((parseFloat(currentInputValue) / selectedTokenPrice).toString()))
            }
        }
    }, [currentInputValue, inputDenomination, selectedTokenPrice, dispatch])

    const handleOnConfirm = useCallback(() => {
        if (!isConnected) {
            signInModal.open()
        } else {
            handleOnNext()
        }
    }, [isConnected, handleOnNext])

    return (
        <div className="space-y-4">
            <FlowHeader />
            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header>
                    <Card.Title style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}>
                        Send to Anyone
                    </Card.Title>
                    <Card.Description>
                        Send funds without needing the recipient's wallet address. They'll get a link to claim in their
                        preferred token and blockchain.
                    </Card.Description>
                </Card.Header>
                <Card.Content className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4">
                        <TokenAmountInput
                            className="w-full"
                            tokenValue={currentInputValue}
                            maxValue={maxValue}
                            setTokenValue={setCurrentInputValue}
                            onSubmit={handleOnConfirm}
                        />
                        {isExternalWallet && (
                            <>
                                <TokenSelector classNameButton="w-full" />
                                {selectedWallet!.balances!.length === 0 && (
                                    <div
                                        onClick={() => {
                                            open()
                                        }}
                                        className="cursor-pointer text-h9 underline"
                                    >
                                        ( Buy Tokens )
                                    </div>
                                )}
                            </>
                        )}

                        <FileUploadInput
                            attachmentOptions={attachmentOptions}
                            setAttachmentOptions={sendFlowActions.setAttachmentOptions}
                        />
                    </div>
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row-reverse">
                        <Button
                            onClick={handleOnConfirm}
                            loading={isLoading}
                            disabled={isLoading || !currentInputValue}
                        >
                            {!isConnected && !isPeanutWallet ? 'Connect Wallet' : isLoading ? loadingState : 'Confirm'}
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

                    <span className="flex flex-row items-center justify-start gap-1 text-h8">
                        Learn about Peanut cashout
                        <MoreInfo
                            text={
                                <>
                                    You can use Peanut to cash out your funds directly to your bank account! (US and EU
                                    only)<br></br>{' '}
                                    <a href="/cashout" className="hover:text-primary underline">
                                        Learn more →
                                    </a>
                                </>
                            }
                        />
                    </span>
                </Card.Content>
            </Card>
        </div>
    )
}

export default InitialSendView
