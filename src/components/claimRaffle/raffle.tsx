'use client'
import { createElement, useEffect, useState } from 'react'
import peanut, { getRaffleLeaderboard, interfaces } from '@squirrel-labs/peanut-sdk'
import { useAccount } from 'wagmi'

import peanutman_logo from '@/assets/peanut/peanutman-logo.svg'
import peanutman_sad from '@/assets/peanut/peanutman-sad.svg'
import * as global_components from '@/components/global'

import * as views from './views'
import * as _consts from './raffle.consts'
import * as consts from '@/consts'
import * as utils from '@/utils'

export function RaffleClaim() {
    const { address } = useAccount()
    const [raffleState, setRaffleState] = useState<_consts.raffleState>('LOADING')
    const [raffleScreen, setRaffleScreen] = useState<_consts.IRaffleScreenState>(_consts.INIT_VIEW)
    const [raffleLink, setRaffleLink] = useState<string>('')
    const [raffleInfo, setRaffleInfo] = useState<interfaces.IRaffleInfo | undefined>()
    const [raffleClaimedInfo, setRaffleClaimedInfo] = useState<interfaces.IClaimRaffleLinkResponse | undefined>()
    const [ensName, setEnsName] = useState<string | undefined>(undefined)
    const [leaderboardInfo, setLeaderboardInfo] = useState<interfaces.IRaffleLeaderboardEntry[] | undefined>(undefined)
    const [senderName, setSenderName] = useState<string | undefined>(undefined)
    const [recipientName, setRecipientName] = useState<string | undefined>(undefined)
    const [userStatus, setUserStatus] = useState<interfaces.IUserRaffleStatus>({
        requiresCaptcha: false,
        userResults: null,
    })

    const handleOnNext = () => {
        const newIdx = raffleScreen.idx + 1
        setRaffleScreen(() => ({
            screen: _consts.RAFFLE_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnCustom = (screen: _consts.Screens) => {
        setRaffleScreen(() => ({
            screen: screen,
            idx: _consts.RAFFLE_SCREEN_FLOW.indexOf(screen),
        }))
    }

    const checkLink = async (link: string) => {
        try {
            const _raffleInfo = await peanut.getRaffleInfo({
                link,
                baseUrl: `${consts.next_proxy_url}/get-raffle-info`,
                APIKey: 'doesnt-matter',
            })
            const userStatus = await peanut.getUserRaffleStatus({
                link,
                userAddress: address,
                baseUrl: `${consts.next_proxy_url}/user-raffle-status`,
                APIKey: 'doesnt-matter',
            })

            const hasAddressParticipated = userStatus.userResults !== null

            setRaffleInfo(_raffleInfo)
            setRaffleLink(link)
            setUserStatus(userStatus)

            if (_raffleInfo.isActive) {
                if (address && hasAddressParticipated && userStatus.requiresCaptcha) {
                    setLeaderboardInfo(
                        await getRaffleLeaderboard({
                            link: link,
                            baseUrl: `${consts.next_proxy_url}/get-raffle-leaderboard`,
                            APIKey: 'doesnt-matter',
                        })
                    )
                    setRaffleScreen(() => ({
                        screen: 'SUCCESS',
                        idx: _consts.RAFFLE_SCREEN_FLOW.indexOf('SUCCESS'),
                    }))
                    setRaffleState('FOUND')
                    // } else if (!address && userStatus.requiresCaptcha) {
                    //     setRaffleState('TOO_LATE')
                } else {
                    setSenderName(_raffleInfo.senderName)
                    setRaffleState('FOUND')
                }
            } else {
                setLeaderboardInfo(
                    await getRaffleLeaderboard({
                        link: link,
                        baseUrl: `${consts.next_proxy_url}/get-raffle-leaderboard`,
                        APIKey: 'doesnt-matter',
                    })
                )
                if (address && hasAddressParticipated) {
                    setRaffleScreen(() => ({
                        screen: 'SUCCESS',
                        idx: _consts.RAFFLE_SCREEN_FLOW.indexOf('SUCCESS'),
                    }))
                    setRaffleState('FOUND')
                } else {
                    setRaffleState('EMPTY')
                }
            }
        } catch (error: any) {
            console.error(error)
            setRaffleState('NOT_FOUND')

            if (error.toString().includes('Service temporarily unavailable')) {
                setRaffleState('TIMEOUT')
            }
            if (error.toString().includes('FUNCTION_INVOCATION_TIMEOUT')) {
                setRaffleState('TIMEOUT')
            }
        }
    }

    useEffect(() => {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : undefined
        if (pageUrl) {
            checkLink(pageUrl)
        }
    }, [])

    return (
        <global_components.PageWrapper bgColor="bg-red">
            <global_components.CardWrapper pt=" pt-16 ">
                {raffleState === 'TIMEOUT' && (
                    <div className="flex w-full flex-col items-center justify-center gap-4 pb-16 pt-16">
                        <img src={peanutman_sad.src} alt="logo" className="h-64 sm:h-64" />
                        <span className="text-center text-xl">
                            Our services are under heavy load. Please try again later.
                        </span>
                    </div>
                )}
                {/* {raffleState === 'TOO_LATE' && (
                    <div className="flex w-full flex-col items-center justify-center gap-4 pb-16 pt-16">
                        <img src={peanutman_sad.src} alt="logo" className="h-64 sm:h-64" />
                        <span className="text-center text-xl">You have already opened this raffle.</span>
                    </div>
                )} */}
                {raffleState === 'LOADING' && (
                    <div className="animate-spin pb-16 pt-16">
                        <img src={peanutman_logo.src} alt="logo" className="h-8 sm:h-16" />
                        <span className="sr-only">Loading...</span>
                    </div>
                )}
                {raffleState === 'NOT_FOUND' && <views.RaffleNotFound />}
                {raffleState === 'EMPTY' && <views.RaffleEmpty leaderboardInfo={leaderboardInfo ?? []} />}

                {raffleState === 'FOUND' &&
                    createElement(_consts.RAFFLE_SCREEN_MAP[raffleScreen.screen].comp, {
                        onNextScreen: handleOnNext,
                        onCustomScreen: handleOnCustom,
                        raffleLink,
                        setRaffleLink,
                        raffleInfo,
                        setRaffleInfo,
                        raffleClaimedInfo,
                        setRaffleClaimedInfo,
                        ensName,
                        setEnsName,
                        leaderboardInfo,
                        setLeaderboardInfo,
                        senderName,
                        setSenderName,
                        recipientName,
                        setRecipientName,
                        userStatus,
                        setUserStatus,
                    } as _consts.IRaffleScreenProps)}
            </global_components.CardWrapper>{' '}
        </global_components.PageWrapper>
    )
}
