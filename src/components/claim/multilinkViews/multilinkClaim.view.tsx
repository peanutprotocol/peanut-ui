import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useMemo, useState, Fragment } from 'react'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'
import { useAtom } from 'jotai'
import peanut from '@squirrel-labs/peanut-sdk'
import { useForm } from 'react-hook-form'
import { Dialog, Transition } from '@headlessui/react'

import * as global_components from '@/components/global'
import * as _consts from '../claim.consts'
import * as utils from '@/utils'
import * as store from '@/store'
import * as consts from '@/consts'
import * as interfaces from '@/interfaces'
import dropdown_svg from '@/assets/dropdown.svg'
import peanutman_logo from '@/assets/peanutman-logo.svg'

export function MultilinkClaimView({
    onNextScreen,
    claimDetails,
    claimLink,
    setTxHash,
    claimType,
    tokenPrice,
}: _consts.IClaimScreenProps) {
    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const [isNftModalOpen, setIsNftModalOpen] = useState(false)
    const [selectedNftIdx, setSelectedNftIdx] = useState<number>(0)

    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [manualErrorState, setManualErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const manualForm = useForm<{ address: string; addressExists: boolean }>({
        mode: 'onChange',
        reValidateMode: 'onChange',
        defaultValues: {
            address: '',
            addressExists: false,
        },
    })

    const claim = async () => {
        try {
            if (claimLink && address) {
                setLoadingStates('executing transaction')

                const claimTxs = []
                for (const link of claimLink) {
                    console.log(link)
                    claimTxs.push(
                        peanut.claimLinkGasless({
                            link,
                            recipientAddress: address,
                            APIKey: process.env.PEANUT_API_KEY ?? '',
                        })
                    )
                }

                console.log('submitted all tx')
                const claimTx = await Promise.all(claimTxs)
                console.log('awaited all tx')

                console.log(claimTx)

                setTxHash(claimTx.map((tx) => tx.transactionHash ?? tx.txHash ?? tx.hash ?? tx.tx_hash ?? ''))

                onNextScreen()
            }
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong while claiming',
            })
            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    const manualClaim = async (data: { address: string; addressExists: boolean }) => {}

    return (
        <>
            <>
                <h2 className="mb-0 mt-2 text-center text-3xl font-black lg:text-5xl ">You have found a multilink!</h2>
                <h3 className="text-md my-1 text-center font-black sm:text-lg lg:text-xl ">
                    This link contains the following tokens:
                </h3>

                <div className="mb-6 mt-2 flex flex-col gap-2 ">
                    {claimDetails.map((link, idx) => {
                        return (
                            <div className="flex items-center gap-2" key={idx}>
                                <img src={peanutman_logo.src} className="h-6 w-6" />
                                {link.tokenType == 2 ? (
                                    <label
                                        className={
                                            'text-md my-1 cursor-pointer text-center font-black underline sm:text-lg lg:text-xl '
                                        }
                                        onClick={() => {
                                            setSelectedNftIdx(idx)
                                            setIsNftModalOpen(true)
                                        }}
                                    >
                                        NFT on{' '}
                                        {chainDetails &&
                                            chainDetails.find((chain) => chain.chainId == link.chainId)?.name}
                                    </label>
                                ) : (
                                    <label className={'text-md my-1 text-center font-black sm:text-lg lg:text-xl '}>
                                        {link.tokenAmount} {link.tokenSymbol} on{' '}
                                        {chainDetails &&
                                            chainDetails.find((chain) => chain.chainId == link.chainId)?.name}
                                    </label>
                                )}
                            </div>
                        )
                    })}
                </div>
            </>

            <button
                type={isConnected ? 'submit' : 'button'}
                className="mx-auto mb-6 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    !isConnected ? open() : claim()
                }}
                disabled={isLoading}
            >
                {isLoading ? (
                    <div className="flex justify-center gap-1">
                        <label>{loadingStates} </label>
                        <div className="flex h-full w-[26px] justify-start pb-1">
                            <div className="loading" />
                        </div>
                    </div>
                ) : isConnected ? (
                    'Claim'
                ) : (
                    'Connect Wallet'
                )}
            </button>
            <div
                className="mt-2 flex cursor-pointer items-center justify-center"
                onClick={() => {
                    setIsDropdownOpen(!isDropdownOpen)
                }}
            >
                <div className="cursor-pointer border-none bg-white text-sm  ">manually enter address</div>
                <img
                    style={{
                        transform: isDropdownOpen ? 'scaleY(-1)' : 'none',
                        transition: 'transform 0.3s ease-in-out',
                    }}
                    src={dropdown_svg.src}
                    alt=""
                    className={'h-6 '}
                />
            </div>
            {isDropdownOpen && (
                <global_components.CardWrapper mb="mb-4">
                    <label className="block text-center text-xs font-medium">
                        If you can't connect, you can also write your address below <br />{' '}
                        <span className="italic">⚠️ WARNING: if you enter a wrong address, funds will get lost!!</span>
                    </label>

                    <form className=" w-full " onSubmit={manualForm.handleSubmit(manualClaim)}>
                        <div className="brutalborder mx-auto mt-4 flex w-11/12 flex-row sm:w-3/4">
                            <input
                                type="text"
                                className="h-4 w-full flex-grow border-none p-4 px-4 placeholder:text-xs placeholder:font-light"
                                placeholder="0x6B37..."
                                {...manualForm.register('address')}
                            />
                            <div className="tooltip w-1/8 brutalborder-left block h-4 cursor-pointer p-2">
                                {isLoading ? (
                                    <div className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold">
                                        <span className="tooltiptext inline " id="myTooltip">
                                            Claiming...
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold"
                                        type="submit"
                                    >
                                        <span className="tooltiptext inline" id="myTooltip">
                                            Claim
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {manualErrorState.showError && (
                            <div className="text-center">
                                <label className="text-xs font-normal text-red ">{manualErrorState.errorMessage}</label>
                            </div>
                        )}

                        <div className="mx-auto mt-2 flex h-4 flex-row items-center justify-center">
                            <input type="checkbox" className="h-4 w-4" {...manualForm.register('addressExists')} />
                            <label className="ml-2 text-xs font-medium">This address exists on CHAIN</label>
                        </div>
                    </form>
                </global_components.CardWrapper>
            )}
            {errorState.showError && (
                <div className="text-center">
                    <label className="font-bold text-red ">{errorState.errorMessage}</label>
                </div>
            )}

            <global_components.PeanutMan type="presenting" />

            <Transition.Root show={isNftModalOpen} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setIsNftModalOpen(false)
                    }}
                >
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
                    </Transition.Child>

                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full min-w-full items-end justify-center text-center sm:items-center ">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                <Dialog.Panel className="brutalborder relative min-h-[240px] w-full transform overflow-hidden rounded-lg rounded-none bg-white pt-5 text-left text-black shadow-xl transition-all sm:mt-8 sm:min-h-[380px] sm:w-auto sm:min-w-[420px] sm:max-w-[420px] ">
                                    <div className="flex flex-col gap-4">
                                        <div>{claimDetails[selectedNftIdx].chainId}</div>
                                        <img src={peanutman_logo.src} className="24 h-24" />
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>
        </>
    )
}
