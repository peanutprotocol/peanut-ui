import * as global_components from '@/components/global'
import * as views from './views'
import * as multilinkViews from './multilinkViews'
import * as _consts from './claim.consts'
import * as interfaces from '@/interfaces'
import { createElement, useEffect, useState } from 'react'
import { getPublicClient, PublicClient } from '@wagmi/core'
import { providers } from 'ethers'
import peanut from '@squirrel-labs/peanut-sdk'
import axios from 'axios'
import peanutman_logo from '@/assets/peanutman-logo.svg'
import ReactGA from 'react-ga4'
import * as hooks from '@/hooks'

export function Claim({ link }: { link: string }) {
    const [linkState, setLinkState] = useState<_consts.linkState>('LOADING')
    const [claimScreen, setClaimScreen] = useState<_consts.IClaimScreenState>(_consts.INIT_VIEW)
    const [claimLink, setClaimLink] = useState<string[]>([])
    const [claimDetails, setClaimDetails] = useState<interfaces.ILinkDetails[]>([])
    const [txHash, setTxHash] = useState<string[]>([])
    const [claimType, setClaimType] = useState<'CLAIM' | 'PROMO'>('CLAIM')
    const [tokenPrice, setTokenPrice] = useState<string | undefined>(undefined)
    const gaEventTracker = hooks.useAnalyticsEventTracker('claim-component')

    const handleOnNext = () => {
        const newIdx = claimScreen.idx + 1
        setClaimScreen(() => ({
            screen: _consts.CLAIM_SCREEN_FLOW[newIdx],
            idx: newIdx,
        }))
    }

    const handleOnCustom = (screen: _consts.ClaimScreens) => {
        setClaimScreen(() => ({
            screen: screen,
            idx: _consts.CLAIM_SCREEN_FLOW.indexOf(screen),
        }))
    }

    const getLinktype = (link: string) => {
        const [, fragment] = link.split('?')
        const urlSearchParams = new URLSearchParams(fragment)

        const i = urlSearchParams.get('i')?.split(',').length

        if (i && i > 1) {
            gaEventTracker('peanut-claim', 'multilink')
            return { type: 'multilink' }
        } else {
            gaEventTracker('peanut-claim', 'normal')
            return { type: 'claim' }
        }
    }

    const isPromoLink = (link: string) => {
        const [, fragment] = link.split('?')
        const urlSearchParams = new URLSearchParams(fragment)

        const linkChainId = urlSearchParams.get('promo')
        const linkVersion = urlSearchParams.get('id')

        if (linkChainId && linkVersion) {
            return true
        } else return false
    }

    const fetchTokenPrice = async (tokenAddress: string, chainId: number) => {
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
            return Number(response.data.result.tokenPrice)
        } catch (error) {
            console.log('error fetching token price for token ' + tokenAddress)
            setTokenPrice(undefined)
        }
    }

    const checkLink = async (link: string) => {
        const promoList: {
            [key: string]: string
        } = JSON.parse(process.env.PROMO_LIST ?? '')
        var localLink

        if (isPromoLink(link)) {
            const [baseUrl, fragment] = link.split('?')
            localLink = baseUrl + '#?' + promoList[fragment] ?? undefined
        } else {
            localLink = link
        }
        if (localLink === undefined) {
            setLinkState('NOT_FOUND')
            return
        }

        try {
            if (getLinktype(link).type === 'multilink') {
                console.log('getting multi link details ' + link)
                const links = await peanut.getLinksFromMultilink(link)
                const linkDetails: interfaces.ILinkDetails[] = await Promise.all(
                    links.map(async (link) => {
                        console.log(link)
                        return peanut.getLinkDetails({ link: link })
                    })
                )

                console.log('linkDetails', linkDetails)
                setClaimLink(links)
                setClaimDetails(linkDetails)
                if (linkDetails.every((link) => link.claimed)) {
                    // implement check for already claimed (amount)
                    setLinkState('MULTILINK_ALREADY_CLAIMED')
                } else {
                    setLinkState('MULTILINK_CLAIM')
                }
            } else {
                console.log('getting link details')
                const linkDetails: interfaces.ILinkDetails = await peanut.getLinkDetails({ link: localLink })
                console.log('linkDetails', linkDetails)

                setClaimLink([localLink.toString()])

                if (Number(linkDetails.tokenAmount) <= 0) {
                    setLinkState('ALREADY_CLAIMED')
                } else {
                    if (linkDetails.tokenAddress == '0x0000000000000000000000000000000000000000') {
                        await fetchTokenPrice('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', linkDetails.chainId)
                    } else {
                        await fetchTokenPrice(linkDetails.tokenAddress, linkDetails.chainId)
                    }
                    setClaimDetails([linkDetails])
                    setLinkState('CLAIM')
                }
            }
        } catch (error) {
            console.log('Error: ', error)
            setLinkState('NOT_FOUND')
        }
    }

    useEffect(() => {
        if (link) {
            checkLink(link)
        }
    }, [link])

    return (
        <global_components.CardWrapper>
            {linkState === 'LOADING' && (
                <div className="animate-spin">
                    <img src={peanutman_logo.src} alt="logo" className="h-6 sm:h-10" />
                    <span className="sr-only">Loading...</span>
                </div>
            )}
            {linkState === 'NOT_FOUND' && <views.ClaimLinkNotFoundView />}
            {linkState === 'ALREADY_CLAIMED' && <views.ClaimLinkAlreadyClaimedView />}
            {linkState === 'CLAIM' &&
                createElement(_consts.CLAIM_SCREEN_MAP[claimScreen.screen].comp, {
                    onNextScreen: handleOnNext,
                    onCustomScreen: handleOnCustom,
                    claimLink,
                    setClaimLink,
                    claimDetails,
                    txHash,
                    setTxHash,
                    claimType,
                    setClaimType,
                    tokenPrice,
                    setTokenPrice,
                } as _consts.IClaimScreenProps)}
            {linkState === 'MULTILINK_CLAIM' &&
                createElement(_consts.MULTILINK_CLAIM_SCREEN_MAP[claimScreen.screen].comp, {
                    onNextScreen: handleOnNext,
                    onCustomScreen: handleOnCustom,
                    claimLink,
                    setClaimLink,
                    claimDetails,
                    txHash,
                    setTxHash,
                    claimType,
                    setClaimType,
                    tokenPrice,
                    setTokenPrice,
                } as _consts.IClaimScreenProps)}
            {linkState === 'MULTILINK_ALREADY_CLAIMED' && (
                <multilinkViews.multilinkAlreadyClaimedView claimDetails={claimDetails} />
            )}
        </global_components.CardWrapper>
    )
}
