'use client'
import { useAccount } from 'wagmi'
import { useState, useMemo, useEffect } from 'react'
import Lottie from 'react-lottie'

import redpacketLottie from '@/assets/lottie/redpacket-lottie.json'
import * as consts from '@/consts'
import * as _consts from '../win.consts'

export function WinInitialView({ onNextScreen }: _consts.IWinScreenProps) {
    const { isConnected, address } = useAccount()
    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const [isLottieStopped, setIsLottieStopped] = useState(false)

    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])

    const defaultLottieOptions = {
        loop: true,
        autoplay: true,
        animationData: redpacketLottie,
        rendererSettings: {
            preserveAspectRatio: 'xMidYMid slice',
        },
    }

    const claim = () => {
        setIsLottieStopped(false)
        setLoadingStates('opening')

        setTimeout(() => {
            onNextScreen()
        }, 3000)
    }

    useEffect(() => {
        setTimeout(() => {
            setIsLottieStopped(true)
        }, 1000)
    }, [])

    return (
        <>
            <h2 className="my-2 mb-0 text-center text-3xl font-black lg:text-6xl ">You received a gift!</h2>
            <h3 className="text-md my-0 text-center font-normal sm:text-lg lg:text-xl ">See what's inside!</h3>
            <div className={'mb-4 mt-0'}>
                <Lottie
                    options={defaultLottieOptions}
                    height={400}
                    width={400}
                    isClickToPauseDisabled
                    isPaused={isLottieStopped}
                />
            </div>

            <button
                type={isConnected ? 'submit' : 'button'}
                className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    !isConnected ? open() : claim()
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
        </>
    )
}
