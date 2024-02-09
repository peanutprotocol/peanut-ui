'use client'
import { createElement, useEffect, useState } from 'react'
import peanut, { hasAddressParticipatedInRaffle, interfaces } from '@squirrel-labs/peanut-sdk'
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

    const getWalletClientAndUpdateSigner = async ({
        chainId,
    }: {
        chainId: string
    }): Promise<providers.JsonRpcSigner | undefined> => {
        try {
            const walletClient = await getWalletClient({ chainId: Number(chainId) })
            if (!walletClient) {
                throw new Error('Failed to get wallet client')
            }
            const signer = utils.walletClientToSigner(walletClient)
            return signer
        } catch (error) {
            console.error(error)
        }
    }

    const checkLink = async (link: string) => {
        try {
            peanut.validateRaffleLink({ link }) // will throw error if not valid
            const _raffleInfo = await peanut.getRaffleInfo({
                link,
                baseUrl: `${consts.next_proxy_url}/get-raffle-info`,
                APIKey: 'doesnt-matter'
            })

            setRaffleInfo(_raffleInfo)
            setRaffleLink(link)

            const hasAddressParticipated = await hasAddressParticipatedInRaffle({
                link: link,
                address: address ?? '',
                baseUrl: `${consts.next_proxy_url}/get-raffle-leaderboard`,
                APIKey: 'doesnt-matter',
            })

            if (_raffleInfo.isActive) {
                if (address && hasAddressParticipated) {
                    setPacketScreen(() => ({
                        screen: 'SUCCESS',
                        idx: _consts.PACKET_SCREEN_FLOW.indexOf('SUCCESS'),
                    }))
                } else {
                    setSenderName(_raffleInfo.senderName)
                }
                setPacketState('FOUND')
            } else {
                if (address && hasAddressParticipated) {
                    setPacketScreen(() => ({
                        screen: 'SUCCESS',
                        idx: _consts.PACKET_SCREEN_FLOW.indexOf('SUCCESS'),
                    }))
                    setRaffleLink(link)
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
                } as _consts.IPacketScreenProps)}
        </global_components.CardWrapper>
    )
}
