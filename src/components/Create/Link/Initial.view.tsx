'use client'

import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useState, useEffect, useContext } from 'react'
import { useCreateLink } from '../useCreateLink'

import * as _consts from '../Create.consts'
import * as _utils from '../Create.utils'
import * as context from '@/context'
import * as utils from '@/utils'
import Loading from '@/components/Global/Loading'
export const CreateLinkInitialView = ({
    onNext,
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
}: _consts.ICreateScreenProps) => {
    const {
        generateLinkDetails,
        assertValues,
        generatePassword,
        makeGaslessDepositPayload,
        prepareDepositTxs,
        switchNetwork,
        estimateGasFee,
    } = useCreateLink()
    const { selectedTokenPrice, inputDenomination, selectedChainID, selectedTokenAddress } = useContext(
        context.tokenSelectorContext
    )
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const { isConnected } = useAccount()
    const { open } = useWeb3Modal()

    const handleConnectWallet = async () => {
        open()
    }

    const handleOnNext = async () => {
        try {
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
            const linkDetails = generateLinkDetails({
                tokenValue: value,
            })
            setLinkDetails(linkDetails)
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
                setFeeOptions(undefined)
                setTransactionCostUSD(undefined)
            } else {
                console.log('gasless not possible, creating normal payload')
                setTransactionType('not-gasless')

                const prepareDepositTxsResponse = await prepareDepositTxs({
                    _linkDetails: linkDetails,
                    _password: password,
                })
                setPreparedDepositTxs(prepareDepositTxsResponse)

                try {
                    const { feeOptions, transactionCostUSD } = await estimateGasFee({
                        chainId: selectedChainID,
                        preparedTx: prepareDepositTxsResponse?.unsignedTxs[0],
                    })

                    setFeeOptions(feeOptions)
                    setTransactionCostUSD(transactionCostUSD)
                } catch (error) {
                    setFeeOptions(undefined)
                    setTransactionCostUSD(undefined)
                }
            }

            await switchNetwork(selectedChainID)

            onNext()
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
            <label className="text-h2">Send crypto with a link</label>
            <label className="max-w-96 text-start text-h8 font-light">
                Choose the chain, set the amount, confirm the transaction. You’ll get a trustless payment link. They
                will be able to claim the funds in any token on any chain.
            </label>
            <div className="flex w-full flex-col items-center justify-center gap-3">
                <TokenAmountInput className="w-full" tokenValue={tokenValue} setTokenValue={setTokenValue} />
                <TokenSelector classNameButton="w-full" />
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <button
                    className="btn-purple btn-xl "
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
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
