import { useRouter } from 'next/navigation'
import { interfaces } from '@squirrel-labs/peanut-sdk'

import * as global_components from '@/components/global'

export function RaffleEmpty({
    leaderboardInfo,
}: {
    leaderboardInfo: interfaces.IRaffleLeaderboardEntry[] | undefined
}) {
    const router = useRouter()

    return (
        <>
            <h2 className="title-font mb-0 text-center text-2xl font-black md:text-3xl">Sorryyy, too late.</h2>

            <h3 className="text-center">This raffle is empty. Make one for your friends.</h3>

            <div className="mb-4">
                <global_components.leaderBoardComp leaderboardInfo={leaderboardInfo ?? []} />
            </div>

            <button
                className="mx-auto mb-4 mt-4 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    router.push('/raffle/create')
                }}
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
