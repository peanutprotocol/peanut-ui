'use client'
import { useForm } from 'react-hook-form'
import { useAccount, useConfig, useSendTransaction, useSwitchChain } from 'wagmi'
import peanut from '@squirrel-labs/peanut-sdk'

import * as consts from '@/constants'
import * as context from '@/context'
import * as utils from '@/utils'
import Select from '../Global/Select'
import { useState, useMemo, useContext } from 'react'
import { useCreateLink } from '../Create/useCreateLink'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { useWeb3Modal } from '@web3modal/wagmi/react'

export const Refund = () => {
    const { isConnected, chain: currentChain } = useAccount()
    const { sendTransactionAsync } = useSendTransaction()
    const config = useConfig()
    const { open } = useWeb3Modal()

    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [claimedExploredUrlWithHash, setClaimedExplorerUrlWithHash] = useState<string | undefined>(undefined)

    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const refundForm = useForm<{
        chainId: string
        transactionHash: string
    }>({
        mode: 'onChange',
        defaultValues: {
            chainId: '1',
            transactionHash: '',
        },
    })
    const refundFormWatch = refundForm.watch()

    const { switchNetwork } = useCreateLink()

    const refundDeposit = async (refundFormData: { chainId: string; transactionHash: string }) => {
        try {
            if (refundFormData.chainId == '' || refundFormData.transactionHash == '') {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please provide a chain and transaction hash',
                })
                return
            }

            await switchNetwork(refundFormData.chainId)

            setLoadingState('Getting deposit details')

            const txReceipt = await peanut.getTxReceiptFromHash(refundFormData.transactionHash, refundFormData.chainId)

            const latestContractVersion = peanut.getLatestContractVersion({
                chainId: refundFormData.chainId,
                type: 'normal',
            })

            const depositIdx = peanut.getDepositIdxs(txReceipt, refundFormData.chainId, latestContractVersion)

            const preparedRefundtx = await peanut.prepareClaimLinkSenderTx({
                chainId: refundFormData.chainId,
                depositIndex: depositIdx[0],
                contractVersion: latestContractVersion,
            })

            let txOptions
            try {
                txOptions = await peanut.setFeeOptions({
                    chainId: refundFormData.chainId,
                })
            } catch (error: any) {
                console.log('error setting fee options, fallback to default')
            }

            const tx = { ...preparedRefundtx, ...txOptions }

            setLoadingState('Sign in wallet')
            const hash = await sendTransactionAsync({
                to: (tx.to ? tx.to : '') as `0x${string}`,
                value: tx.value ? BigInt(tx.value.toString()) : undefined,
                data: tx.data ? (tx.data as `0x${string}`) : undefined,
                gas: txOptions?.gas ? BigInt(txOptions.gas.toString()) : undefined,
                gasPrice: txOptions?.gasPrice ? BigInt(txOptions.gasPrice.toString()) : undefined,
                maxFeePerGas: txOptions?.maxFeePerGas ? BigInt(txOptions?.maxFeePerGas.toString()) : undefined,
                maxPriorityFeePerGas: txOptions?.maxPriorityFeePerGas
                    ? BigInt(txOptions?.maxPriorityFeePerGas.toString())
                    : undefined,
            })

            setLoadingState('Executing transaction')

            await waitForTransactionReceipt(config, {
                confirmations: 2,
                hash: hash,
                chainId: Number(refundFormData.chainId),
            })

            const explorerUrl = utils.getExplorerUrl(refundFormData.chainId)
            setClaimedExplorerUrlWithHash(`${explorerUrl}/tx/${hash}`)
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong while claiming',
            })
            console.error(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <div className="card">
            <div className="flex w-full flex-col items-center justify-center gap-6 py-2 text-center">
                <label className="text-h2">Refund</label>
                <div className="max-w-96 text-start text-h8 font-light">
                    This is a page specific for refunding links that failed while creating, but the funds did leave your
                    wallet. Please provide the transaction hash and chainId, and you will be able to claim. Please note
                    that you will have to be connected with the same wallet that you tried creating the link with.
                </div>

                <form
                    className="flex w-full flex-col items-center gap-2 px-4 sm:gap-7"
                    onSubmit={refundForm.handleSubmit(refundDeposit)}
                >
                    <div className="grid w-full grid-cols-1 items-center justify-center gap-2 sm:grid-cols-2">
                        <label className="font-h7 font-bold">Chain</label>
                        <Select
                            className="h-8 border border-n-1 p-1 outline-none"
                            classButton="h-auto px-0 border-none bg-trasparent text-sm !font-normal"
                            classOptions="-left-4 -right-3 w-auto py-1 overflow-auto max-h-36"
                            classArrow="ml-1"
                            items={consts.supportedPeanutChains}
                            value={
                                consts.supportedPeanutChains.find((chain) => chain.chainId === refundFormWatch.chainId)
                                    ?.name
                            }
                            onChange={(chainId: any) => {
                                refundForm.setValue('chainId', chainId.chainId)
                            }}
                        />

                        <label className="font-h7 font-bold">Transaction hash</label>
                        <input
                            placeholder="0x123..."
                            className="h-8 border border-n-1 p-1 outline-none"
                            {...refundForm.register('transactionHash')}
                        />
                    </div>
                    <div
                        className={
                            errorState.showError
                                ? 'mx-auto mb-0 mt-4 flex w-full flex-col items-center gap-10 sm:mt-0'
                                : 'mx-auto mb-8 mt-4 flex w-full flex-col items-center sm:mt-0'
                        }
                    >
                        <button
                            type={isConnected ? 'submit' : 'button'}
                            className="btn-purple btn-xl"
                            onClick={() => {
                                if (!isConnected) {
                                    open()
                                }
                            }}
                            disabled={isLoading || claimedExploredUrlWithHash ? true : false}
                        >
                            {isLoading ? (
                                <div className="flex justify-center gap-1">
                                    <label>{loadingState} </label>
                                    <span className="bouncing-dots flex">
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                    </span>
                                </div>
                            ) : !isConnected ? (
                                'Connect Wallet'
                            ) : claimedExploredUrlWithHash ? (
                                'Success'
                            ) : (
                                'Refund'
                            )}
                        </button>
                        {claimedExploredUrlWithHash ? (
                            <p className="tx-sm mt-4">
                                <a
                                    href={claimedExploredUrlWithHash ?? ''}
                                    target="_blank"
                                    className="cursor-pointer text-center text-sm text-black underline "
                                >
                                    Your transaction hash
                                </a>
                            </p>
                        ) : (
                            errorState.showError && (
                                <div className="text-center">
                                    <label className="font-bold text-red ">{errorState.errorMessage}</label>
                                </div>
                            )
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Refund
