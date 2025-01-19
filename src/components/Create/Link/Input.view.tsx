'use client'

import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { useAppKit } from '@reown/appkit/react'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useCreateLink } from '../useCreateLink'

import { Button, Card } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import FileUploadInput from '@/components/Global/FileUploadInput'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import * as context from '@/context'
import { useWalletType } from '@/hooks/useWalletType'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useWallet } from '@/hooks/wallet/useWallet'
import { WalletProviderType } from '@/interfaces'
import { balanceByToken, ErrorHandler, floorFixed, isNativeCurrency, printableAddress, printableUsdc } from '@/utils'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { formatEther } from 'viem'
import * as _consts from '../Create.consts'
import { isGaslessDepositPossible } from '../Create.utils'

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
    createType = 'link', // note: default to link view temporarily
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
    const {
        selectedTokenPrice,
        inputDenomination,
        selectedChainID,
        setSelectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
    } = useContext(context.tokenSelectorContext)
    const { walletType, environmentInfo } = useWalletType()
    const { handleLogin } = useZeroDev()
    const toast = useToast()

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [_tokenValue, _setTokenValue] = useState<string | undefined>(
        inputDenomination === 'TOKEN' ? tokenValue : usdValue
    )

    const { open } = useAppKit()

    const handleConnectWallet = async () => {
        open()
    }
    const { selectedWallet, signInModal, isConnected, address, isExternalWallet, isPeanutWallet } = useWallet()

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
                if (_isGaslessDepositPossible && selectedWallet?.walletProviderType !== WalletProviderType.PEANUT) {
                    // PW userops are marked as 'not-gasless' in this flow, since
                    // they will become gasless via the paymaster
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

                    // Dev block
                    // Overwrite approval to 0 amount to re-test approvals

                    // let chainId = linkDetails.chainId
                    // let tokenAddress = linkDetails.tokenAddress!
                    // let provider = undefined
                    // let spenderAddress = undefined

                    // let contractVersion = getLatestContractVersion({ chainId: linkDetails.chainId, type: 'normal' })

                    // const defaultProvider = provider || (await getDefaultProvider(chainId))
                    // const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, defaultProvider)

                    // const _PEANUT_CONTRACTS = PEANUT_CONTRACTS as { [chainId: string]: { [contractVersion: string]: string } }
                    // const spender = spenderAddress || (_PEANUT_CONTRACTS[chainId] && _PEANUT_CONTRACTS[chainId][contractVersion])

                    // const tx = await tokenContract.populateTransaction.approve(spender, BigInt(0))
                    // const peanutTxs: any = {unsignedTxs: [ethersV5ToPeanutTx(tx)]}

                    // prepareDepositTxsResponse = peanutTxs

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
        if (!selectedWallet?.balances) {
            return selectedWallet?.balance ? printableUsdc(selectedWallet.balance) : ''
        }
        const balance = balanceByToken(selectedWallet.balances, selectedChainID, selectedTokenAddress)
        if (!balance) return ''
        // 6 decimal places, prettier
        return floorFixed(balance.amount, 6)
    }, [selectedChainID, selectedTokenAddress, selectedWallet?.balances, selectedWallet?.balance])

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

    useEffect(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [isPeanutWallet])

    return (
        <>
            <FlowHeader />
            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header className="mx-auto text-center">
                    <Card.Title
                        style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}
                        className="mx-auto text-center"
                    >
                        {' '}
                        {createType === 'link'
                            ? 'Text Tokens'
                            : createType === 'direct'
                              ? `Send to ${recipient.name?.endsWith('.eth') ? recipient.name : printableAddress(recipient.address ?? '')}`
                              : `Send to ${recipient.name}`}
                    </Card.Title>
                    <Card.Description className="mx-auto max-w-96 text-center">
                        {createType === 'link' &&
                            'Deposit some crypto to the link, no need for wallet addresses. Send the link to the recipient. They will be able to claim the funds in any token on any chain from the link.'}
                        {createType === 'email_link' &&
                            `You will send an email to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                        {createType === 'sms_link' &&
                            `You will send a text message to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                        {createType === 'direct' &&
                            `You will do a direct blockchain transaction to ${recipient.name ?? recipient.address}. Ensure the recipient address is correct, else the funds might be lost.`}
                    </Card.Description>
                </Card.Header>
                <Card.Content className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4">
                        <TokenAmountInput
                            className="w-full"
                            tokenValue={_tokenValue}
                            maxValue={maxValue}
                            setTokenValue={_setTokenValue}
                            onSubmit={() => {
                                if (!isConnected) signInModal.open()
                                else handleOnNext()
                            }}
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
                        {(createType === 'link' || createType === 'email_link' || createType === 'sms_link') && (
                            <FileUploadInput
                                attachmentOptions={attachmentOptions}
                                setAttachmentOptions={setAttachmentOptions}
                            />
                        )}
                    </div>
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row-reverse">
                        <Button
                            onClick={() => {
                                if (!isConnected) {
                                    if (isPeanutWallet) {
                                        setLoadingState('Logging in')
                                        handleLogin()
                                            .then(() => {
                                                handleOnNext()
                                            })
                                            .catch((_error) => {
                                                toast.error('Error logging in')
                                            })
                                            .finally(() => {
                                                setLoadingState('Idle')
                                            })
                                    } else {
                                        signInModal.open()
                                    }
                                } else {
                                    handleOnNext()
                                }
                            }}
                            loading={isLoading}
                            disabled={isLoading || !tokenValue}
                        >
                            {!isConnected && !isPeanutWallet ? 'Connect Wallet' : isLoading ? loadingState : 'Confirm'}
                        </Button>
                        {/* <Button variant="stroke" onClick={onPrev} disabled={isLoading}>
                        Go Back
                    </Button> */}
                    </div>
                    {errorState.showError && (
                        <div className="text-center">
                            <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                        </div>
                    )}
                    {!crossChainDetails.find(
                        (chain: any) => chain.chainId.toString() === selectedChainID.toString()
                    ) && (
                        <span className=" text-h8 font-normal ">
                            <Icon name="warning" className="-mt-0.5" /> This chain does not support cross-chain
                            claiming.
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
                </Card.Content>
            </Card>
        </>
    )
}
