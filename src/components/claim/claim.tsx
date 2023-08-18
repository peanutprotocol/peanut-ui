import * as global_components from '@/components/global'
import * as views from './views'
import * as _consts from './claim.consts'
import * as interfaces from '@/interfaces'
import { createElement, useEffect, useState } from 'react'
import { ReadonlyURLSearchParams } from 'next/navigation'
import { getPublicClient, PublicClient } from '@wagmi/core'
import { providers } from 'ethers'
import { HttpTransport } from 'viem'
import { useAccount } from 'wagmi'
const peanut = require('@squirrel-labs/peanut-sdk')

export function Claim({ link }: { link: ReadonlyURLSearchParams }) {
    const { address, isConnected } = useAccount()
    const [linkState, setLinkState] = useState<_consts.linkState>('LOADING')
    const [claimScreen, setClaimScreen] = useState<_consts.IClaimScreenState>(_consts.INIT_VIEW)
    const [claimLink, setClaimLink] = useState<string>('')
    const [claimDetails, setClaimDetails] = useState<interfaces.ILinkDetails | undefined>(undefined)
    const [txHash, setTxHash] = useState<string>('')

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

        if (transport.type === 'fallback')
            return new providers.FallbackProvider(
                (transport.transports as ReturnType<HttpTransport>[]).map(
                    ({ value }) => new providers.JsonRpcProvider(value?.url, network)
                )
            )
        return new providers.JsonRpcProvider(transport.url, network)
    }

    function getEthersProvider({ chainId }: { chainId?: number } = {}) {
        const publicClient = getPublicClient({ chainId })
        return publicClientToProvider(publicClient)
    }

    const checkLink = async (link: ReadonlyURLSearchParams) => {
        const linkChainId = link.get('c')
        const _link = link.toString()
        setClaimLink(_link)
        const provider = getEthersProvider({ chainId: Number(linkChainId) })

        try {
            const linkDetails: interfaces.ILinkDetails = await peanut.getLinkDetails(
                provider,
                'https://peanut.to/claim#?' + _link
            )

            if (Number(linkDetails.tokenAmount) <= 0) {
                setLinkState('ALREADY_CLAIMED')
            } else {
                setClaimDetails(linkDetails)
                setLinkState('CLAIM')
            }
        } catch (error) {
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
                <div role="status">
                    <svg
                        aria-hidden="true"
                        className="inline h-6 w-6 animate-spin fill-white text-black dark:text-black"
                        viewBox="0 0 100 101"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                            fill="currentColor"
                        />
                        <path
                            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                            fill="currentFill"
                        />
                    </svg>
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
                } as _consts.IClaimScreenProps)}
        </global_components.CardWrapper>
    )
}
