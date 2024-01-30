'use client'
import { useAccount } from 'wagmi'
import { useState, useMemo, useEffect } from 'react'
import Lottie from 'react-lottie'
import peanut from '@squirrel-labs/peanut-sdk'
import axios from 'axios'

import * as global_components from '@/components/global'
import redpacketLottie from '@/assets/lottie/redpacket-lottie.json'
import * as consts from '@/consts'
import * as _consts from '../packet.consts'
import { useWeb3Modal } from '@web3modal/wagmi/react'

export function PacketInitialView({
    onNextScreen,
    raffleInfo,
    raffleLink,
    setRaffleClaimedInfo,
    tokenPrice,
    setTokenPrice,
}: _consts.IPacketScreenProps) {
    const { open } = useWeb3Modal()
    const { isConnected, address } = useAccount()
    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const [isLottieStopped, setIsLottieStopped] = useState(false)

    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])

    const defaultLottieOptions = {
        loop: true,
        autoplay: true,
        animationData: redpacketLottie,
        rendererSettings: {
            preserveAspectRatio: 'xMidYMid slice',
        },
    }

    const fetchTokenPrice = async (tokenAddress: string, chainId: string) => {
        try {
            const response = await axios.get('https://api.socket.tech/v2/token-price', {
                params: {
                    tokenAddress: tokenAddress,
                    chainId: chainId,
                },
                headers: {
                    accept: 'application/json',
                    'API-KEY': process.env.SOCKET_API_KEY,
                },
            })
            setTokenPrice(response.data.result.tokenPrice)
        } catch (error) {
            console.log('error fetching token price for token ' + tokenAddress)
        }
    }

    const claim = async () => {
        setIsLottieStopped(false)
        setLoadingStates('opening')
        try {
            const raffleClaimedInfo = await peanut.claimRaffleLink({
                link: raffleLink,
                APIKey: process.env.PEANUT_API_KEY ?? '',
                recipientAddress: address ?? '',
            })

            setRaffleClaimedInfo(raffleClaimedInfo)
            onNextScreen()
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong while claiming',
            })
            console.error(error)
        } finally {
            setIsLottieStopped(true)
            setLoadingStates('idle')
        }
    }

    useEffect(() => {
        setTimeout(() => {
            setIsLottieStopped(true)
        }, 1000)
    }, [])

    useEffect(() => {
        if (raffleInfo?.tokenAddress) {
            fetchTokenPrice(raffleInfo.tokenAddress, raffleInfo.chainId)
        }
    }, [raffleInfo])

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
            {errorState.showError && (
                <div className="mt-4 text-center">
                    <label className="font-bold text-red ">{errorState.errorMessage}</label>
                </div>
            )}
            <global_components.PeanutMan type="redpacket" />
        </>
    )
}
