'use client'
import { useAccount } from 'wagmi'
import { useState, useMemo, useEffect } from 'react'
import peanut, {
    claimRaffleLink,
    getRaffleLeaderboard,
    validateUserName,
    getUserRaffleStatus,
} from '@squirrel-labs/peanut-sdk'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useForm } from 'react-hook-form'
import { ethers } from 'ethersv5'
import { useLottie } from 'lottie-react'
import ReCAPTCHA from 'react-google-recaptcha'
import { useAtom } from 'jotai'

import dropdown_svg from '@/assets/icons/dropdown.svg'
import redpacketLottie from '@/assets/lottie/redpacket-lottie.json'

import * as global_components from '@/components/global'
import * as consts from '@/consts'
import * as utils from '@/utils'
import * as store from '@/store'

import * as _consts from '../raffle.consts'

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

export function RaffleInitialView({
    onNextScreen,
    raffleLink,
    raffleInfo,
    setRaffleClaimedInfo,
    ensName,
    setLeaderboardInfo,
    senderName,
    recipientName,
    userStatus,
}: _consts.IRaffleScreenProps) {
    const { open } = useWeb3Modal()
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const { isConnected, address } = useAccount()
    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isValidAddress, setIsValidAddress] = useState(false)
    const [isEnsName, setIsEnsName] = useState<{ state: boolean; address: string }>({ state: false, address: '' })
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
    const mantleCheck = utils.isMantleInUrl()

    const { View: lottieView, goToAndStop, play, stop } = useLottie(defaultLottieOptions, defaultLottieStyle)

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
        if (isLoading) return

        if (userStatus.requiresCaptcha && !captchaToken) {
            setErrorState({
                showError: true,
                errorMessage: 'Please complete the captcha',
            })
            return
        }

        setErrorState({
            showError: false,
            errorMessage: '',
        })

        play()
        setLoadingStates('opening')
        try {
            try {
                if (claimFormData.name) {
                    claimFormData.name = validateUserName(claimFormData.name)
                }
            } catch (error) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Invalid name',
                })
                return
            }

            let recipientAddress
            if (isEnsName.state) {
                recipientAddress = isEnsName.address
            } else if (isValidAddress) {
                recipientAddress = claimForm.getValues('address') ?? ''
            } else if (address) {
                recipientAddress = address
            } else {
                throw new Error('Invalid address')
            }

            const _userStatus = await getUserRaffleStatus({
                link: raffleLink,
                userAddress: recipientAddress,
                baseUrl: `${consts.next_proxy_url}/user-raffle-status`,
                APIKey: 'doesnt-matter',
            })
            const hasAddressParticipated = _userStatus.userResults !== null

            if (hasAddressParticipated) {
                setErrorState({
                    showError: true,
                    errorMessage: 'You have already claimed a slot in this raffle!',
                })
                setLoadingStates('idle')
                goToAndStop(30, true)
                return
            }

            const raffleClaimedInfo = await claimRaffleLink({
                link: raffleLink,
                recipientAddress: recipientAddress ?? '',
                recipientName: claimFormData.name ?? '',
                APIKey: 'doesnt-matter',
                baseUrlAuth: `${consts.next_proxy_url}/get-authorisation`,
                baseUrlClaim: `${consts.next_proxy_url}/claim-v2`,
                captchaResponse: captchaToken ?? '',
            })

            const leaderboardInfo = await getRaffleLeaderboard({
                link: raffleLink,
                baseUrl: `${consts.next_proxy_url}/get-raffle-leaderboard`,
                APIKey: 'doesnt-matter',
            })
            console.log('fresh leaderboard!', leaderboardInfo)
            setLeaderboardInfo(leaderboardInfo)

            setRaffleClaimedInfo(raffleClaimedInfo)

            onNextScreen()
        } catch (error: any) {
            setLoadingStates('idle')
            goToAndStop(30, true)
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong while claiming',
            })

            if (error.message == 'Invalid address') {
                setErrorState({
                    showError: true,
                    errorMessage: 'Invalid address, try again after refreshing ',
                })
            }

            if (error.message == 'All slots have already been claimed') {
                window.location.reload()
            }
        } finally {
            setLoadingStates('idle')
            goToAndStop(30, true)
        }
    }

    useEffect(() => {
        if (recipientName) claimForm.setValue('name', recipientName)
        else if (ensName) {
            if (claimForm.getValues('name') === undefined || claimForm.getValues('name') === '')
                claimForm.setValue('name', ensName)
        }
    }, [ensName])

    const [debouncedAddress, setDebouncedAddress] = useState(formwatch.address)

    async function checkAddress(address: string) {
        try {
            if (address.endsWith('.eth')) {
                setLoadingStates('fetching address')
                const resolvedAddress = await utils.resolveFromEnsName(address)
                if (resolvedAddress) {
                    address = resolvedAddress
                    setIsEnsName({ state: true, address })
                } else {
                    return
                }
            }
            if (!ethers.utils.isAddress(address)) {
                setIsValidAddress(false)
                return
            }
            const _userStatus = await peanut.getUserRaffleStatus({
                link: raffleLink,
                userAddress: address,
                baseUrl: `${consts.next_proxy_url}/user-raffle-status`,
                APIKey: 'doesnt-matter',
            })
            const hasAddressParticipated = _userStatus.userResults !== null

            if (hasAddressParticipated) {
                setErrorState({
                    showError: true,
                    errorMessage: 'This address has already claimed their slot!',
                })
            } else {
                setErrorState({
                    showError: false,
                    errorMessage: '',
                })
                setIsValidAddress(true)
            }
        } catch (error) {
            console.error('Error while validating address input field:', error)
            setErrorState({
                showError: true,
                errorMessage: `Error: ${String(error)}`,
            })
        } finally {
            setLoadingStates('idle')
        }
    }

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedAddress(formwatch.address)
        }, 750)

        return () => {
            clearTimeout(handler)
        }
    }, [formwatch.address])

    useEffect(() => {
        if (debouncedAddress) {
            checkAddress(debouncedAddress)
        }
    }, [debouncedAddress])

    useEffect(() => {
        goToAndStop(35, true)
    }, [])

    const checkSpecialChar = (e: any) => {
        if (!/[0-9a-zA-Z]/.test(e.key)) {
            e.preventDefault()
        }
    }

    const handleCaptchaChange = (value: string | null) => {
        setCaptchaToken(value)
    }

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

            <div className="mb-6 flex flex-col items-center justify-center gap-2">
                <div className=" flex h-[58px] w-[248px] flex-col gap-2 border-4 border-solid !px-4 !py-1">
                    <div className="font-normal">Your address/ensname</div>
                    <div className="flex flex-row items-center justify-between">
                        <input
                            className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                            placeholder="0x1234...5678"
                            type="text"
                            autoComplete="off"
                            onFocus={(e) => e.target.select()}
                            {...claimForm.register('address')}
                        />
                    </div>
                </div>
                <div className="text-sm ">
                    Please ensure that this address exists on{' '}
                    {chainDetails && chainDetails.find((chain) => chain.chainId == raffleInfo?.chainId)?.name}
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
                <div className=" cursor-pointer border-none bg-white text-sm ">Claim your peanut handle</div>
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
                <div className="my-4 flex h-[58px] w-[248px] flex-col gap-2 border-4 border-solid !px-4 !py-1">
                    <div className="font-normal">Peanut handle</div>
                    <div className="flex flex-row items-center justify-between">
                        <input
                            className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                            placeholder="Chad"
                            type="text"
                            autoComplete="off"
                            maxLength={20}
                            onKeyDown={checkSpecialChar}
                            onFocus={(e) => e.target.select()}
                            {...claimForm.register('name')}
                        />
                    </div>
                </div>
            )}
            {userStatus.requiresCaptcha && (
                <ReCAPTCHA sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''} onChange={handleCaptchaChange} />
            )}
            <button
                type={isConnected || isValidAddress ? 'submit' : 'button'}
                className={
                    ' mt-8 block w-[90%] cursor-pointer bg-white p-5  px-2 text-2xl font-black sm:w-2/5 lg:w-1/2'
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
                ) : (
                    'Open'
                )}
            </button>
            {errorState.showError && (
                <div className="mt-4 text-center">
                    <label className="font-bold text-red ">{errorState.errorMessage}</label>
                </div>
            )}
            <global_components.PeanutMan type={'presenting'} />
        </form>
    )
}
