import { useAtom } from 'jotai'

import * as _consts from '../packet.consts'
import * as utils from '@/utils'
import * as store from '@/store'

export function PacketSuccesView({ raffleClaimedInfo, tokenPrice, raffleInfo }: _consts.IPacketScreenProps) {
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    return (
        <>
            <h2 className="my-0 text-center text-3xl font-black lg:text-6xl ">You got</h2>
            {tokenPrice ? (
                <div className={'mb-4 mt-4 flex flex-col items-center justify-center gap-4'}>
                    <h1 className=" text-md mb-8 mt-4 text-center font-black sm:text-6xl lg:text-8xl ">
                        {`$${utils.formatTokenAmount(Number(raffleClaimedInfo.amountReceived) * tokenPrice)}`}{' '}
                    </h1>
                    <h3 className="text-md my-0 text-center font-normal sm:text-lg lg:text-xl ">
                        {utils.formatTokenAmount(Number(raffleClaimedInfo.amountReceived))}{' '}
                        {raffleClaimedInfo.tokenSymbol} on{' '}
                        {chainDetails && chainDetails.find((chain) => chain.chainId == raffleInfo?.chainId)?.name}
                    </h3>
                </div>
            ) : (
                <div className={'mb-4 mt-4 flex flex-col items-center justify-center gap-4'}>
                    <h1 className="text-md my-0 text-center font-black sm:text-6xl lg:text-8xl ">
                        {utils.formatTokenAmount(Number(raffleClaimedInfo.amountReceived))}{' '}
                        {raffleClaimedInfo.tokenSymbol}
                    </h1>
                    <h3 className="text-md my-0 text-center font-normal sm:text-lg lg:text-xl ">
                        on {chainDetails && chainDetails.find((chain) => chain.chainId == raffleInfo?.chainId)?.name}
                    </h3>
                </div>
            )}
            <h3 className="text-md mb-4 mt-2 text-center font-normal sm:text-lg lg:text-xl ">
                Create a red packet link to send to your friend group chat
            </h3>
            <button
                type={'button'}
                className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
            >
                Create
            </button>
        </>
    )
}
