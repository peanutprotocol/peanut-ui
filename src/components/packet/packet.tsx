'use client'
import { createElement, useEffect, useState } from 'react'
import peanut, { getRaffleLeaderboard, interfaces } from '@squirrel-labs/peanut-sdk'
import { useAccount } from 'wagmi'
import { getWalletClient } from '@wagmi/core'
import { providers } from 'ethers'

import peanutman_logo from '@/assets/peanutman-logo.svg'
import * as global_components from '@/components/global'

import * as views from './views'
import * as _consts from './packet.consts'
import * as consts from '@/consts'
import * as utils from '@/utils'

export function Packet() {
    const { address } = useAccount()
    const [packetState, setPacketState] = useState<_consts.packetState>('LOADING')
    const [packetScreen, setPacketScreen] = useState<_consts.IPacketScreenState>(_consts.INIT_VIEW)
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
        const newIdx = packetScreen.idx + 1
        setPacketScreen(() => ({
            screen: _consts.PACKET_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnCustom = (screen: _consts.Screens) => {
        setPacketScreen(() => ({
            screen: screen,
            idx: _consts.PACKET_SCREEN_FLOW.indexOf(screen),
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
                if (address && hasAddressParticipated) {
                    setLeaderboardInfo(
                        await getRaffleLeaderboard({
                            link: link,
                            baseUrl: `${consts.next_proxy_url}/get-raffle-leaderboard`,
                            APIKey: 'doesnt-matter',
                        })
                    )
                    setPacketScreen(() => ({
                        screen: 'SUCCESS',
                        idx: _consts.PACKET_SCREEN_FLOW.indexOf('SUCCESS'),
                    }))
                } else {
                    setSenderName(_raffleInfo.senderName)
                }
                setPacketState('FOUND')
            } else {
                setLeaderboardInfo(
                    await getRaffleLeaderboard({
                        link: link,
                        baseUrl: `${consts.next_proxy_url}/get-raffle-leaderboard`,
                        APIKey: 'doesnt-matter',
                    })
                )
                if (address && hasAddressParticipated) {
                    setPacketScreen(() => ({
                        screen: 'SUCCESS',
                        idx: _consts.PACKET_SCREEN_FLOW.indexOf('SUCCESS'),
                    }))
                    setPacketState('FOUND')
                } else {
                    setPacketState('EMPTY')
                }
            }
        } catch (error) {
            console.error(error)
            setPacketState('NOT_FOUND')
        }
    }

    useEffect(() => {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
        if (pageUrl) {
            checkLink(pageUrl)
        }
    }, [])

    async function getEnsName(address: string) {
        const ensName = await peanut.resolveToENSName({
            address: address,
        })
        if (ensName) {
            setEnsName(ensName)
        }
    }

    useEffect(() => {
        if (address) {
            getEnsName(address)
        }
    }, [address])

    return (
        <global_components.CardWrapper pt=" pt-16 " redPacket>
            {packetState === 'LOADING' && (
                <div className="animate-spin pb-16 pt-16">
                    <img src={peanutman_logo.src} alt="logo" className="h-8 sm:h-16" />
                    <span className="sr-only">Loading...</span>
                </div>
            )}
            {packetState === 'NOT_FOUND' && <views.PacketNotFound />}
            {packetState === 'EMPTY' && <views.PacketEmpty leaderboardInfo={leaderboardInfo ?? []} />}

            {packetState === 'FOUND' &&
                createElement(_consts.PACKET_SCREEN_MAP[packetScreen.screen].comp, {
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
                } as _consts.IPacketScreenProps)}
        </global_components.CardWrapper>
    )
}
