'use client'

import { createElement, useEffect, useState } from 'react'
import peanut, { interfaces } from '@squirrel-labs/peanut-sdk'
import { useAccount } from 'wagmi'

import peanutman_logo from '@/assets/peanutman-logo.svg'
import * as global_components from '@/components/global'
import * as utils from '@/utils'

import * as views from './views'
import * as _consts from './packet.consts'

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

    async function fetchLeaderboardInfo(link: string) {
        const _leaderboardInfo = await peanut.getRaffleLeaderboard({
            link: link,
            APIKey: process.env.PEANUT_API_KEY ?? '',
        })

        setLeaderboardInfo(_leaderboardInfo)
    }

    const checkLink = async (link: string) => {
        try {
            //TODO: add check in SDK to know if its empty or not found
            if (await peanut.isRaffleActive({ link })) {
                const _raffleInfo = await peanut.getRaffleInfo({ link })
                if (
                    await peanut.hasAddressParticipatedInRaffle({
                        link: link,
                        address: address ?? '',
                        APIKey: process.env.PEANUT_API_KEY ?? '',
                    })
                ) {
                    setRaffleInfo(_raffleInfo)
                    await fetchLeaderboardInfo(link)
                    setPacketState('FOUND')
                    setRaffleLink(link)
                    setPacketScreen(() => ({
                        screen: 'SUCCESS',
                        idx: _consts.PACKET_SCREEN_FLOW.indexOf('SUCCESS'),
                    }))
                } else {
                    const url = new URL(link)

                    const senderAddress = await utils.getSenderAddress({
                        chainId: _raffleInfo.chainId.toString(),
                        contractVersion: url.searchParams.get('v') ?? '',
                        depositIdx: Number(url.searchParams.get('i')?.split(',')[0] ?? 0),
                    })
                    const name = await peanut.getUsername({
                        address: senderAddress,
                        APIKey: process.env.PEANUT_API_KEY ?? '',
                        link: link,
                    })
                    setRaffleInfo(_raffleInfo)
                    setSenderName(name)
                    setPacketState('FOUND')
                    setRaffleLink(link)
                }
            } else {
                await fetchLeaderboardInfo(link)
                setPacketState('EMPTY')
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
                } as _consts.IPacketScreenProps)}
        </global_components.CardWrapper>
    )
}
