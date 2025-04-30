'use client'

import { isGaslessDepositPossible } from '@/components/Create/Create.utils'
import { useCreateLink } from '@/components/Create/useCreateLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import PeanutSponsored from '@/components/Global/PeanutSponsored'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { LoadingStates } from '@/constants/loadingStates.consts'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWalletType } from '@/hooks/useWalletType'
import { useWallet } from '@/hooks/wallet/useWallet'
import { WalletProviderType } from '@/interfaces'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { walletActions } from '@/redux/slices/wallet-slice'
import { balanceByToken, ErrorHandler, floorFixed, isNativeCurrency, printableUsdc } from '@/utils'
import { captureException } from '@sentry/nextjs'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Button } from '../../../0_Bruddle'
import FileUploadInput from '../../../Global/FileUploadInput'
import Icon from '../../../Global/Icon'
import MoreInfo from '../../../Global/MoreInfo'
import TokenAmountInput from '../../../Global/TokenAmountInput'
import TokenSelector from '../../../Global/TokenSelector/TokenSelector'
import { createAndProcessLink } from '../../utils/createLinkUtils'

// helper function to update both token and usd values in redux
const updateTokenAndUsdValues = (
    dispatch: any,
    currentInputValue: string | undefined,
    inputDenomination: string,
    selectedTokenPrice: number | undefined
) => {
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
}

// handles the transaction flow for external wallets (non-peanut)
// prepares the transaction and navigates to the confirm view
const processStandardWalletTransaction = async (
    linkDetails: any,
    password: string,
    selectedChainID: string,
    selectedTokenAddress: string,
    selectedWallet: any,
    WalletProviderType: any,
    makeGaslessDepositPayload: any,
    prepareDepositTxs: any,
    estimateGasFee: any,
    estimatePoints: any,
    address: string | undefined,
    usdValue: string | undefined,
    switchNetwork: any,
    dispatch: any,
    setLoadingState: any
) => {
    setLoadingState('Preparing transaction')

    let prepareDepositTxsResponse
    const _isGaslessDepositPossible = isGaslessDepositPossible({
        chainId: selectedChainID,
        tokenAddress: selectedTokenAddress,
    })

    if (_isGaslessDepositPossible && selectedWallet?.walletProviderType !== WalletProviderType.PEANUT) {
        dispatch(sendFlowActions.setTransactionType('gasless'))

        const makeGaslessDepositResponse = await makeGaslessDepositPayload({
            _linkDetails: linkDetails,
            _password: password,
        })

        if (!makeGaslessDepositResponse || !makeGaslessDepositResponse.payload || !makeGaslessDepositResponse.message)
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

        try {
            const { feeOptions, transactionCostUSD } = await estimateGasFee({
                chainId: selectedChainID,
                preparedTx: prepareDepositTxsResponse?.unsignedTxs[0],
            })

            dispatch(sendFlowActions.setFeeOptions(feeOptions))
            dispatch(sendFlowActions.setTransactionCostUSD(transactionCostUSD))
        } catch (error) {
            console.error(error)
            dispatch(sendFlowActions.setFeeOptions(undefined))
            dispatch(sendFlowActions.setTransactionCostUSD(undefined))
            captureException(error)
        }
    }

    // todo: rethink if we need this rn? - kushagra
    // estimate points
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

    // continue to confirm view
    dispatch(sendFlowActions.setView('CONFIRM'))
}

const LinkSendInitialView = () => {
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
        sendTransactions,
        signTypedData,
        makeDepositGasless,
        getLinkFromHash,
        submitClaimLinkInit,
        submitClaimLinkConfirm,
    } = useCreateLink()

    const { selectedTokenPrice, inputDenomination, selectedChainID, selectedTokenAddress, selectedTokenData } =
        useContext(tokenSelectorContext)

    const { setLoadingState, loadingState, isLoading } = useContext(loadingStateContext)

    const [currentInputValue, setCurrentInputValue] = useState<string | undefined>(
        (inputDenomination === 'TOKEN' ? tokenValue : usdValue) ?? ''
    )
    const {
        selectedWallet,
        signInModal,
        isConnected,
        address,
        isExternalWallet,
        isPeanutWallet,
        refetchBalances,
        peanutWalletDetails,
    } = useWallet()

    const peanutWalletBalance = useMemo(() => {
        if (!peanutWalletDetails?.balance) return undefined
        return printableUsdc(peanutWalletDetails.balance)
    }, [peanutWalletDetails?.balance])

    const maxValue = useMemo(() => {
        if (!selectedWallet?.balances) {
            return selectedWallet?.balance ? printableUsdc(selectedWallet.balance) : ''
        }
        const balance = balanceByToken(selectedWallet.balances, selectedChainID, selectedTokenAddress)
        if (!balance) return ''
        // 6 decimal places, prettier
        return floorFixed(balance.amount, PEANUT_WALLET_TOKEN_DECIMALS)
    }, [selectedChainID, selectedTokenAddress, selectedWallet?.balances, selectedWallet?.balance])

    const handleOnNext = async () => {
        try {
            if (isLoading || (isConnected && !currentInputValue)) return

            setLoadingState('Loading')

            // clear any previous errors
            dispatch(
                sendFlowActions.setErrorState({
                    showError: false,
                    errorMessage: '',
                })
            )

            // update token and usd values in redux based on user input
            updateTokenAndUsdValues(dispatch, currentInputValue, inputDenomination, selectedTokenPrice)

            // check wallet balance
            try {
                // for native tokens, we need to consider gas fees
                if (isNativeCurrency(selectedTokenAddress)) {
                    // Get a rough gas estimate - this could be optimized
                    const roughGasEstimate = 0.001 // A conservative estimate in native token units
                    checkUserHasEnoughBalance({
                        tokenValue: tokenValue!,
                        gasAmount: roughGasEstimate,
                    })
                    // await checkUserHasEnoughBalance({
                    //     tokenValue: tokenValue!,
                    //     gasAmount: roughGasEstimate,
                    // })
                } else {
                    checkUserHasEnoughBalance({ tokenValue: tokenValue! })
                    // await checkUserHasEnoughBalance({ tokenValue: tokenValue! })
                }
            } catch (error) {
                // if balance check fails, show error
                const errorString = ErrorHandler(error)
                dispatch(
                    sendFlowActions.setErrorState({
                        showError: true,
                        errorMessage: errorString,
                    })
                )
                setLoadingState('Idle')
                return
            }

            // generate link details and password
            setLoadingState('Generating details')
            const linkDetails = generateLinkDetails({
                tokenValue: tokenValue,
                envInfo: environmentInfo,
                walletType: walletType,
            })
            dispatch(sendFlowActions.setLinkDetails({ ...linkDetails }))
            const password = await generatePassword()
            dispatch(sendFlowActions.setPassword(password))

            // proceed based on wallet type
            if (isPeanutWallet) {
                // for peanut wallet, create link directly without confirmation step
                try {
                    // prepare deposit transactions
                    const prepareDepositTxsResponse = await prepareDepositTxs({
                        _linkDetails: linkDetails,
                        _password: password,
                    })
                    dispatch(sendFlowActions.setPreparedDepositTxs(prepareDepositTxsResponse))
                    dispatch(sendFlowActions.setTransactionType('not-gasless'))

                    // use shared utility to create and process the link
                    await createAndProcessLink({
                        transactionType: 'not-gasless',
                        preparedDepositTxs: prepareDepositTxsResponse as peanutInterfaces.IPrepareDepositTxsResponse,
                        linkDetails: linkDetails as peanutInterfaces.IPeanutLinkDetails,
                        password,
                        attachmentOptions: attachmentOptions || {
                            rawFile: undefined,
                            message: undefined,
                            fileUrl: undefined,
                        },
                        address,
                        selectedChainID,
                        usdValue,
                        selectedTokenPrice,
                        estimatedPoints: 0,
                        selectedTokenAddress,
                        selectedTokenDecimals: selectedTokenData?.decimals,
                        feeOptions: undefined,
                        sendTransactions: async ({ preparedDepositTxs, feeOptions }) => {
                            return (await sendTransactions({ preparedDepositTxs, feeOptions })) || ''
                        },
                        signTypedData: async ({ gaslessMessage }) => {
                            return await signTypedData({ gaslessMessage })
                        },
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
                        submitClaimLinkConfirm: async ({
                            chainId,
                            link,
                            password,
                            txHash,
                            senderAddress,
                            amountUsd,
                            transaction,
                        }) => {
                            await submitClaimLinkConfirm({
                                chainId,
                                link,
                                password,
                                txHash,
                                senderAddress,
                                amountUsd,
                                transaction,
                            })
                        },
                        walletType: walletType as 'blockscout' | undefined,
                        refetchBalances: (address) => refetchBalances(address),
                        dispatch,
                        setLoadingState: (state) => setLoadingState(state as LoadingStates),
                    })
                } catch (error) {
                    throw error
                }
            } else {
                // for external wallets, prepare transaction and go to confirm view
                await processStandardWalletTransaction(
                    linkDetails,
                    password,
                    selectedChainID,
                    selectedTokenAddress,
                    selectedWallet,
                    WalletProviderType,
                    makeGaslessDepositPayload,
                    prepareDepositTxs,
                    estimateGasFee,
                    estimatePoints,
                    address,
                    usdValue,
                    switchNetwork,
                    dispatch,
                    setLoadingState
                )
            }
        } catch (error) {
            // handle errors
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

    useEffect(() => {
        if (!!peanutWalletDetails) dispatch(walletActions.setSelectedWalletId(peanutWalletDetails.id))
    }, [peanutWalletDetails])

    return (
        <div className="w-full space-y-4">
            {/* <FlowHeader disableWalletHeader={isLoading} /> */}

            <PeanutActionCard type="send" />

            <TokenAmountInput
                className="w-full"
                tokenValue={currentInputValue}
                maxValue={maxValue}
                setTokenValue={setCurrentInputValue}
                onSubmit={handleOnConfirm}
                walletBalance={peanutWalletBalance}
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
                setAttachmentOptions={(options) => dispatch(sendFlowActions.setAttachmentOptions(options))}
            />

            {isPeanutWallet && <PeanutSponsored />}

            <div className="flex flex-col gap-4">
                <Button onClick={handleOnConfirm} loading={isLoading} disabled={isLoading || !currentInputValue}>
                    {!isConnected && !isPeanutWallet ? 'Connect Wallet' : isLoading ? loadingState : 'Create link'}
                </Button>
                {errorState?.showError && <ErrorAlert description={errorState.errorMessage} />}
            </div>
            {!crossChainDetails?.find((chain: any) => chain.chainId.toString() === selectedChainID.toString()) && (
                <span className=" text-start text-h8 font-normal">
                    <Icon name="warning" className="-mt-0.5" /> This chain does not support cross-chain claiming.
                </span>
            )}

            <span className="flex flex-row items-center justify-start gap-1 text-h8">
                Learn about Peanut cashout
                <MoreInfo
                    text={
                        <>
                            You can use Peanut to cash out your funds directly to your bank account! (US and EU only)
                            <br></br>{' '}
                            <a href="/cashout" className="hover:text-primary underline">
                                Learn more →
                            </a>
                        </>
                    }
                />
            </span>
        </div>
    )
}

export default LinkSendInitialView
