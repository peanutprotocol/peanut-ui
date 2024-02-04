'use client'
import { useAccount } from 'wagmi'
import { useState, useMemo, useEffect, useRef } from 'react'
import Lottie from 'react-lottie'
import peanut from '@squirrel-labs/peanut-sdk'

import * as global_components from '@/components/global'
import redpacketLottie from '@/assets/lottie/redpacket-lottie.json'
import * as consts from '@/consts'
import * as _consts from '../packet.consts'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useForm } from 'react-hook-form'

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
    const [isLottieStopped, setIsLottieStopped] = useState(true)

    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const claimForm = useForm<{
        name: string | undefined
    }>({
        mode: 'onChange',
        defaultValues: {
            name: undefined,
        },
    })

    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])

    const defaultLottieOptions = {
        loop: true,
        autoplay: true,
        animationData: redpacketLottie,
        rendererSettings: {
            preserveAspectRatio: 'xMidYMid slice',
        },
    }

    const animationRef = useRef(null)

    const claim = async (claimFormData: { name: string | undefined }) => {
        setErrorState({
            showError: false,
            errorMessage: '',
        })

        setIsLottieStopped(false)
        setLoadingStates('opening')
        try {
            const raffleClaimedInfo = await peanut.claimRaffleLink({
                link: raffleLink,
                APIKey: process.env.PEANUT_API_KEY ?? '',
                recipientAddress: address ?? '',
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
            setIsLottieStopped(true)
            setLoadingStates('idle')
        }
    }

    const goToAndStop = (frame: number, isFrame: boolean = true) => {
        //@ts-ignore
        const animationInstance = animationRef.current?.anim
        if (animationInstance) {
            animationInstance.goToAndStop(frame, isFrame)
        }
    }

    useEffect(() => {
        goToAndStop(30, true)
    }, [])

    useEffect(() => {
        if (recipientName) claimForm.setValue('name', recipientName)
        else if (ensName) {
            if (claimForm.getValues('name') === undefined || claimForm.getValues('name') === '')
                claimForm.setValue('name', ensName)
        }
    }, [ensName])

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
            <div className={'mb-4 mt-0'}>
                <Lottie
                    options={defaultLottieOptions}
                    height={400}
                    width={400}
                    isClickToPauseDisabled
                    ref={animationRef}
                    isStopped={isLottieStopped}
                />
            </div>

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

            <button
                type={isConnected ? 'submit' : 'button'}
                className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    if (!isConnected) {
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
                ) : isConnected ? (
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
