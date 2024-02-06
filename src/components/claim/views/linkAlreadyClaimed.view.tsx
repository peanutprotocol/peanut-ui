import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import * as global_components from '@/components/global'
import * as hooks from '@/hooks'
import * as _consts from '../claim.consts'
import * as interfaces from '@/interfaces'
import * as store from '@/store'
import { useAtom } from 'jotai'

export function ClaimLinkAlreadyClaimedView({ claimDetails }: { claimDetails: interfaces.ILinkDetails[] }) {
    const router = useRouter()
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const gaEventTracker = hooks.useAnalyticsEventTracker('claim-component')

    useEffect(() => {
        router.prefetch('/send')
        gaEventTracker('peanut-claimed', 'link already claimed')
    }, [])

    return (
        <>
            <h2 className="title-font mb-0 text-center text-2xl font-black md:text-3xl">
                Sorry, this link has been claimed already.
            </h2>
            <h3 className="mb-3 text-center">
                This link previously held {claimDetails[0].tokenSymbol} on{' '}
                {chainDetails && chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.name}
            </h3>

            <h3 className="mt-2 text-center">Generate a payment link yourself to see how it works!</h3>

            <button
                className="mx-auto mb-4 mt-4 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    router.push('/send')
                }}
            >
                Send Crypto
            </button>

            <p className="mt-4 text-center text-xs">
                Thoughts? Feedback? Use cases? Memes? Hit us up on{' '}
                <a href="https://discord.gg/BX9Ak7AW28" target="_blank" className="cursor-pointer text-black underline">
                    Discord
                </a>
                !
            </p>

            <global_components.PeanutMan type="sad" />
        </>
    )
}
