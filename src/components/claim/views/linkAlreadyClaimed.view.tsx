import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import * as global_components from '@/components/global'
export function ClaimLinkAlreadyClaimedView() {
    const router = useRouter()

    useEffect(() => {
        router.prefetch('/')
    }, [])

    return (
        <>
            <h2 className="title-font mb-0 text-center text-2xl font-black md:text-3xl">
                Sorry, this link has been claimed already.
            </h2>

            <h3 className="text-center">Generate a payment link yourself to see how it works!</h3>

            <button
                className="mx-auto mb-4 mt-4 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    router.push('/')
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
