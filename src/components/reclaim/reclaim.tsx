'use client'
import * as global_components from '@/components/global'
import peanut, { setFeeOptions } from '@squirrel-labs/peanut-sdk'
import * as store from '@/store'
import * as consts from '@/consts'
import { useAtom } from 'jotai'
import { useState, useMemo } from 'react'
import { useAccount, useSendTransaction, useConfig } from 'wagmi'
import { useForm } from 'react-hook-form'
import { waitForTransactionReceipt } from 'wagmi/actions'

export function Reclaim() {
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { isConnected } = useAccount()
    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const { sendTransactionAsync } = useSendTransaction()
    const config = useConfig()
    const [claimedExploredUrlWithHash, setClaimedExplorerUrlWithHash] = useState<string | undefined>(undefined)

    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])

    const reclaimForm = useForm<{
        chainId: string
        transactionHash: string
    }>({
        mode: 'onChange',
        defaultValues: {
            chainId: '1',
            transactionHash: '',
        },
    })

    async function reclaimDeposit(reclaimFormData: { chainId: string; transactionHash: string }) {
        try {
            if (reclaimFormData.chainId == '' || reclaimFormData.transactionHash == '') {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please provide a chain and transaction hash',
                })
                return
            }
            setLoadingStates('getting deposit details')

            const txReceipt = await peanut.getTxReceiptFromHash(
                reclaimFormData.transactionHash,
                reclaimFormData.chainId
            )
            console.log(txReceipt)

            const latestContractVersion = peanut.getLatestContractVersion({
                chainId: reclaimFormData.chainId,
                type: 'normal',
            })
            console.log(latestContractVersion)

            const depositIdx = peanut.getDepositIdxs(txReceipt, reclaimFormData.chainId, latestContractVersion)
            console.log(depositIdx)

            const preparedReclaimtx = await peanut.prepareClaimLinkSenderTx({
                chainId: reclaimFormData.chainId,
                depositIndex: depositIdx[0],
                contractVersion: latestContractVersion,
            })
            console.log(preparedReclaimtx)

            let txOptions
            try {
                txOptions = await setFeeOptions({
                    chainId: reclaimFormData.chainId,
                })
            } catch (error: any) {
                console.log('error setting fee options, fallback to default')
            }

            const tx = { ...preparedReclaimtx, ...txOptions }
            console.log(tx)

            setLoadingStates('sign in wallet')
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
            console.log(hash)

            setLoadingStates('executing transaction')
            await waitForTransactionReceipt(config, {
                confirmations: 2,
                hash: hash,
                chainId: Number(reclaimFormData.chainId),
            })

            const explorerUrl = chainDetails.find(
                (chain) => chain.chainId.toString() == reclaimFormData.chainId.toString()
            ).explorers[0].url
            setClaimedExplorerUrlWithHash(`${explorerUrl}/tx/${hash}`)
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    return (
        <global_components.CardWrapper>
            <div className=" mb-6 mt-10 flex w-full flex-col items-center gap-2 text-center">
                <h2 className="title-font bold my-0 text-2xl lg:text-4xl">Reclaim</h2>
                <div className="my-0 w-4/5 font-normal">
                    This is a page specific for reclaiming links that failed while creating, but the funds did leave
                    your wallet. Please provide the transaction hash and chainId, and you will be able to claim. Please
                    note that you will have to be connected with the same wallet that you tried creating the link with.
                </div>
            </div>

            <form className="w-full" onSubmit={reclaimForm.handleSubmit(reclaimDeposit)}>
                <div className="flex w-full flex-col items-center gap-2 sm:gap-7">
                    <div className="grid grid-cols-2 items-center justify-center gap-2">
                        <label>Chain</label>
                        <select className="brutalborder p-1" {...reclaimForm.register('chainId')}>
                            {chainDetails.map((detail: any) => {
                                return (
                                    <option key={detail.chainId} value={detail.chainId}>
                                        {detail.name}
                                    </option>
                                )
                            })}
                        </select>

                        <label>Transaction hash</label>
                        <input
                            placeholder="0x123..."
                            className="brutalborder p-1"
                            {...reclaimForm.register('transactionHash')}
                        />
                    </div>
                    <div
                        className={
                            errorState.showError || claimedExploredUrlWithHash
                                ? 'mx-auto mb-0 mt-4 flex w-full flex-col items-center gap-10 sm:mt-0'
                                : 'mx-auto mb-8 mt-4 flex w-full flex-col items-center sm:mt-0'
                        }
                    >
                        <button
                            type={isConnected ? 'submit' : 'button'}
                            className="mt-2 block w-[90%] cursor-pointer bg-white p-2 px-1  text-2xl font-black sm:w-2/5 lg:w-1/2"
                            id="cta-btn"
                            onClick={() => {
                                if (!isConnected) {
                                    open()
                                }
                            }}
                            disabled={isLoading || claimedExploredUrlWithHash ? true : false}
                        >
                            {isLoading ? (
                                <div className="flex justify-center gap-1">
                                    <label>{loadingStates} </label>
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
                                'Claim'
                            )}
                        </button>
                        {claimedExploredUrlWithHash ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                                {' '}
                                Success! Your funds will be available in your wallet again shortly.
                                <p className="tx-sm">
                                    <a
                                        href={claimedExploredUrlWithHash ?? ''}
                                        target="_blank"
                                        className="cursor-pointer text-center text-sm text-black underline "
                                    >
                                        Your transaction hash
                                    </a>
                                </p>
                            </div>
                        ) : (
                            errorState.showError && (
                                <div className="text-center">
                                    <label className="font-bold text-red ">{errorState.errorMessage}</label>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </form>
        </global_components.CardWrapper>
    )
}
