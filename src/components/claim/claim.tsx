import * as global_components from '@/components/global'
import * as views from './views'
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
    const [claimLink, setClaimLink] = useState<string>('')
    const [claimDetails, setClaimDetails] = useState<interfaces.ILinkDetails | undefined>(undefined)
    const [txHash, setTxHash] = useState<string>('')
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

    function publicClientToProvider(publicClient: PublicClient) {
        const { chain, transport } = publicClient
        const network = {
            chainId: chain.id,
            name: chain.name,
            ensAddress: chain.contracts?.ensRegistry?.address,
        }

        if (transport.type === 'fallback') {
            return null
        }
        return new providers.JsonRpcProvider(transport.url, network)
    }

    function getEthersProvider({ chainId }: { chainId?: number } = {}) {
        try {
            const publicClient = getPublicClient({ chainId })
            return publicClientToProvider(publicClient)
        } catch (error) {
            console.log(error)
        }
    }

    const getLinktype = (link: string) => {
        const [, fragment] = link.split('?')
        const urlSearchParams = new URLSearchParams(fragment)
        const linkChainId = urlSearchParams.get('promo')
        const linkVersion = urlSearchParams.get('id')
        if (linkChainId && linkVersion) {
            setClaimType('PROMO')
            gaEventTracker('peanut-claim', 'Promo')
            return { type: 'promo' }
        } else {
            gaEventTracker('peanut-claim', 'normal')
            return { type: 'claim' }
        }
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
        const type = getLinktype(link)
        var localLink
        if (type.type === 'promo') {
            const [baseUrl, fragment] = link.split('?')
            localLink = baseUrl + '#?' + promoList[fragment] ?? undefined
        } else {
            localLink = link
        }
        if (localLink === undefined) {
            setLinkState('NOT_FOUND')
            return
        }

        const [, fragment] = localLink.split('#')
        const urlSearchParams = new URLSearchParams(fragment)
        const linkChainId = urlSearchParams.get('c')
        const provider = getEthersProvider({ chainId: Number(linkChainId) })
        const _link = localLink.toString()
        setClaimLink(_link)

        try {
            console.log('getting link details')
            const linkDetails: interfaces.ILinkDetails = await peanut.getLinkDetails(provider, _link, true)
            console.log('linkDetails', linkDetails)

            if (Number(linkDetails.tokenAmount) <= 0) {
                setLinkState('ALREADY_CLAIMED')
            } else {
                if (linkDetails.tokenAddress == '0x0000000000000000000000000000000000000000') {
                    await fetchTokenPrice('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', linkDetails.chainId)
                } else {
                    await fetchTokenPrice(linkDetails.tokenAddress, linkDetails.chainId)
                }
                setClaimDetails(linkDetails)
                setLinkState('CLAIM')
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
        </global_components.CardWrapper>
    )
}
