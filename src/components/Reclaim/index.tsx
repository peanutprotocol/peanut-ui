'use client'
import { useForm } from 'react-hook-form'
import { useAccount } from 'wagmi'

import * as consts from '@/constants'
import Select from '../Global/Select'

export const Reclaim = () => {
    const { isConnected, chain: currentChain } = useAccount()

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

    return (
        <div className="card">
            <div className="flex w-full flex-col items-center justify-center gap-6 py-2 text-center">
                <label className="text-h2">Reclaim</label>
                <div className="max-w-96 text-start text-h8 font-light">
                    This is a page specific for reclaiming links that failed while creating, but the funds did leave
                    your wallet. Please provide the transaction hash and chainId, and you will be able to claim. Please
                    note that you will have to be connected with the same wallet that you tried creating the link with.
                </div>

                <form className="flex w-full flex-col items-center gap-2 px-4 sm:gap-7">
                    <div className="grid w-full grid-cols-1 items-center justify-center gap-2 sm:grid-cols-2">
                        <label className="font-h7 font-bold">Chain</label>
                        <Select
                            className="h-8 border border-n-1 p-1 outline-none"
                            classButton="h-auto px-0 border-none bg-trasparent text-sm !font-normal"
                            classOptions="-left-4 -right-3 w-auto py-1 overflow-auto max-h-36"
                            classArrow="ml-1"
                            items={consts.supportedPeanutChains}
                            value={consts.supportedPeanutChains[0].name}
                            onChange={(chainId: string) => {
                                reclaimForm.setValue('chainId', chainId)
                            }}
                        />

                        <label className="font-h7 font-bold">Transaction hash</label>
                        <input
                            placeholder="0x123..."
                            className="h-8 border border-n-1 p-1 outline-none"
                            {...reclaimForm.register('transactionHash')}
                        />
                    </div>
                    <div
                        className={'mx-auto mt-4 flex w-full flex-col items-center sm:mt-0'} // change this depending on errorstate
                    >
                        <button
                            type={isConnected ? 'submit' : 'button'}
                            className="btn-purple btn-xl"
                            onClick={() => {
                                if (!isConnected) {
                                    open()
                                }
                            }}
                            // disabled={isLoading || claimedExploredUrlWithHash ? true : false}
                        >
                            {/* {isLoading ? (
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
                            )} */}
                            Claim
                        </button>
                        {/* {claimedExploredUrlWithHash ? (
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
                                    <label className="text-red font-bold ">{errorState.errorMessage}</label>
                                </div>
                            )
                        )} */}
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Reclaim
