'use client'
import { useAccount } from 'wagmi'
import { useState, useMemo, useEffect } from 'react'
import peanut from '@squirrel-labs/peanut-sdk'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useForm } from 'react-hook-form'
import { ethers } from 'ethersv5'
import { useLottie } from 'lottie-react'

import dropdown_svg from '@/assets/dropdown.svg'
import redpacketLottie from '@/assets/lottie/redpacket-lottie.json'

import * as global_components from '@/components/global'
import * as consts from '@/consts'
import * as _consts from '../packet.consts'

const defaultLottieOptions = {
    animationData: redpacketLottie,
    loop: true,
    autoplay: true,
    rendererSettings: {
        preserveAspectRatio: 'xMidYMid slice',
    },
}

const defaultLottieStyle = {
    height: 400,
    width: 400,
}

export function PacketInitialView({
    onNextScreen,
    raffleLink,
    setRaffleClaimedInfo,
    ensName,
    setLeaderboardInfo,
    senderName,
    recipientName,
}: _consts.IPacketScreenProps) {
    const { open } = useWeb3Modal()
    const { isConnected, address } = useAccount()
    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isValidAddress, setIsValidAddress] = useState(false)

    const { View: lottieView, goToAndStop, play } = useLottie(defaultLottieOptions, defaultLottieStyle)

    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const claimForm = useForm<{
        name: string | undefined
        address: string | undefined
    }>({
        mode: 'onChange',
        defaultValues: {
            name: undefined,
            address: undefined,
        },
    })

    const formwatch = claimForm.watch()

    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])

    const claim = async (claimFormData: { name: string | undefined }) => {
        setErrorState({
            showError: false,
            errorMessage: '',
        })

        play()
        setLoadingStates('opening')
        try {
            const raffleClaimedInfo = await peanut.claimRaffleLink({
                link: raffleLink,
                APIKey: process.env.PEANUT_API_KEY ?? '',
                recipientAddress: isValidAddress ? claimForm.getValues('address') ?? '' : address ?? '',
                recipientName: claimFormData.name,
            })

            const leaderboardInfo = await peanut.getRaffleLeaderboard({
                link: raffleLink,
                APIKey: process.env.PEANUT_API_KEY ?? '',
            })
            setLeaderboardInfo(leaderboardInfo)

            setRaffleClaimedInfo(raffleClaimedInfo)

            onNextScreen()
        } catch (error: any) {
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong while claiming',
            })

            if (error.message == 'All slots have already been claimed for this raffle') {
                window.location.reload()
            }
        } finally {
            setLoadingStates('idle')
        }
    }

    useEffect(() => {
        if (recipientName) claimForm.setValue('name', recipientName)
        else if (ensName) {
            if (claimForm.getValues('name') === undefined || claimForm.getValues('name') === '')
                claimForm.setValue('name', ensName)
        }
    }, [ensName])

    useEffect(() => {
        if (formwatch.address && ethers.utils.isAddress(formwatch.address)) {
            setIsValidAddress(true)
        } else {
            setIsValidAddress(false)
        }
    }, [formwatch.address])

    useEffect(() => {
        goToAndStop(30, true)
    }, [])

    return (
        <form className="flex w-full flex-col items-center justify-center" onSubmit={claimForm.handleSubmit(claim)}>
            {senderName ? (
                <h2 className="my-2 mb-2 text-center text-3xl font-black lg:text-6xl ">
                    {senderName} sent you a gift!
                </h2>
            ) : (
                <h2 className="my-2 mb-2 text-center text-3xl font-black lg:text-6xl ">You received a gift!</h2>
            )}
            <h3 className="text-md my-0 text-center font-normal sm:text-lg lg:text-xl ">See what's inside!</h3>
            <div className={'mb-4 mt-0'}>{lottieView}</div>

            <div className="mb-6 flex h-[58px] w-[248px] flex-col gap-2 border-4 border-solid !px-4 !py-1">
                <div className="font-normal">Name</div>
                <div className="flex flex-row items-center justify-between">
                    <input
                        className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent text-xl font-bold outline-none"
                        placeholder="Chad"
                        type="text"
                        autoComplete="off"
                        onFocus={(e) => e.target.select()}
                        {...claimForm.register('name')}
                    />
                </div>
            </div>

            <div
                className={
                    ' mt-2 flex cursor-pointer items-center justify-center ' + (isDropdownOpen ? ' mb-0' : ' mb-4')
                }
                onClick={() => {
                    setIsDropdownOpen(!isDropdownOpen)
                }}
            >
                <div className=" cursor-pointer border-none bg-white text-sm ">Claim without connecting</div>
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
                <div className="flex flex-col items-center justify-center gap-2">
                    <div className=" my-2 cursor-pointer border-none bg-white text-sm">
                        Fill out your address if you can't connect your wallet.
                    </div>

                    <div className="mb-6 flex h-[58px] w-[248px] flex-col gap-2 border-4 border-solid !px-4 !py-1">
                        <div className="font-normal">Address</div>
                        <div className="flex flex-row items-center justify-between">
                            <input
                                className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent text-xl font-bold outline-none"
                                placeholder="0x1234...5678"
                                type="text"
                                autoComplete="off"
                                onFocus={(e) => e.target.select()}
                                {...claimForm.register('address')}
                            />
                        </div>
                    </div>
                </div>
            )}

            <button
                type={isConnected || isValidAddress ? 'submit' : 'button'}
                className={
                    ' block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2 ' +
                    (isDropdownOpen ? ' mt-8' : ' mt-2')
                }
                id="cta-btn"
                onClick={() => {
                    if (!isValidAddress && !isConnected) {
                        open()
                    }
                }}
                disabled={isLoading}
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
                ) : isConnected || isValidAddress ? (
                    'Open'
                ) : (
                    'Connect Wallet'
                )}
            </button>
            {errorState.showError && (
                <div className="mt-4 text-center">
                    <label className="font-bold text-red ">{errorState.errorMessage}</label>
                </div>
            )}
            <global_components.PeanutMan type="redpacket" />
        </form>
    )
}
