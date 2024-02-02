import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'

import * as utils from '@/utils'
import * as store from '@/store'
import * as global_components from '@/components/global'
import * as _consts from '../packet.consts'
import { useEffect } from 'react'

const claimsArray = [
    {
        amount: 10,
        name: 'John Doe',
    },
    {
        amount: 5,
        name: 'Jane Doe',
    },
    {
        amount: 2,
        name: 'John Doe',
    },
    {
        amount: 1,
        name: 'Jane Doe',
    },
    {
        amount: 3,
        name: 'John Doe',
    },
    {
        amount: 4,
        name: 'Jane Doe',
    },
    {
        amount: 6,
        name: 'John Doe',
    },
    {
        amount: 7,
        name: 'Jane Doe',
    },
    {
        amount: 8,
        name: 'John Doe',
    },
    {
        amount: 9,
        name: 'Jane Doe',
    },
]

export function PacketSuccesView({ raffleClaimedInfo, raffleInfo }: _consts.IPacketScreenProps) {
    const router = useRouter()
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    useEffect(() => {
        router.prefetch('/send')
    }, [])

    return (
        <div className="mb-4 mt-2 flex w-full flex-col items-center gap-6 text-center ">
            <h2 className="my-0 text-center text-2xl font-black lg:text-4xl ">You got</h2>

            <div className={'flex flex-col items-center justify-center gap-4'}>
                <h1 className="text-md my-0 text-center font-black sm:text-4xl lg:text-6xl ">
                    {utils.formatTokenAmount(Number(raffleClaimedInfo.amountReceived))} {raffleClaimedInfo.tokenSymbol}
                </h1>
                <h3 className="text-md my-0 text-center font-black sm:text-lg lg:text-xl ">
                    on {chainDetails && chainDetails.find((chain) => chain.chainId == raffleInfo?.chainId)?.name}
                </h3>
            </div>

            <div className="flex flex-col items-center justify-center gap-2">
                <h3 className="text-md my-0 text-center font-normal sm:text-lg lg:text-xl ">See how lucky you were!</h3>
                <div></div>
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
                message={`I just claimed ${utils.formatTokenAmount(Number(raffleClaimedInfo.amountReceived))} ${
                    raffleClaimedInfo.tokenSymbol
                } on peanut.to!`}
            />
            <global_components.PeanutMan type="redpacket" />
        </div>
    )
}
