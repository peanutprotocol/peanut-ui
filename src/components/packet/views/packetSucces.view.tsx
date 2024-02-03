import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'

import * as utils from '@/utils'
import * as store from '@/store'
import * as global_components from '@/components/global'
import * as _consts from '../packet.consts'
import { useEffect, useState } from 'react'
import peanut from '@squirrel-labs/peanut-sdk'
import { useAccount } from 'wagmi'
export function PacketSuccesView({ raffleClaimedInfo, raffleInfo, leaderboardInfo }: _consts.IPacketScreenProps) {
    const { address } = useAccount()
    const router = useRouter()
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    useEffect(() => {
        router.prefetch('/send')
        console.log(leaderboardInfo?.find((user) => user.address == address)?.amount)
    }, [])

    return (
        <div className="mb-4 mt-2 flex w-full flex-col items-center gap-6 text-center ">
            <h2 className="my-0 text-center text-2xl font-black lg:text-4xl ">You got</h2>

            <div className={'flex flex-col items-center justify-center gap-4'}>
                <h1 className="text-md my-0 text-center font-black sm:text-4xl lg:text-6xl ">
                    {utils.formatTokenAmount(
                        Number(
                            raffleClaimedInfo?.amountReceived ??
                                leaderboardInfo?.find((user) => user.address == address)?.amount
                        )
                    )}{' '}
                    {raffleInfo?.tokenSymbol}
                </h1>
                <h3 className="text-md my-0 text-center font-black sm:text-lg lg:text-xl ">
                    on {chainDetails && chainDetails.find((chain) => chain.chainId == raffleInfo?.chainId)?.name}
                </h3>
            </div>

            <div className="flex flex-col items-center justify-center gap-2">
                <h3 className="text-md my-0 text-center font-normal sm:text-lg lg:text-xl ">See how lucky you were!</h3>

                <global_components.leaderBoardComp leaderboardInfo={leaderboardInfo ?? []} />
            </div>

            <h3 className="text-md text-center font-normal sm:text-lg lg:text-xl ">
                Create a red packet link to send to your friend group chat
            </h3>
            <button
                type={'button'}
                className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    router.push('/create-packet')
                }}
            >
                Create
            </button>

            <global_components.socialsComponent
                message={`I just claimed ${utils.formatTokenAmount(
                    Number(
                        raffleClaimedInfo?.amountReceived ??
                            leaderboardInfo?.find((user) => user.address == address)?.amount
                    )
                )} ${raffleInfo?.tokenSymbol} on peanut.to!`}
            />
            <global_components.PeanutMan type="redpacket" />
        </div>
    )
}
