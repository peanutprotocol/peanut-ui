import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import * as global_components from '@/components/global'
import * as hooks from '@/hooks'

export function WinLinkEmpty() {
    const router = useRouter()

    return (
        <>
            <h2 className="title-font mb-0 text-center text-2xl font-black md:text-3xl">Sorryyy, too late.</h2>

            <h3 className="text-center">This red packet is already empty.</h3>

            <button
                className="mx-auto mb-4 mt-4 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    router.push('/send')
                }} // TODO: update push here
            >
                Create
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
