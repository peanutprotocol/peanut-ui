import { useEffect, useMemo, useState } from 'react'
import { useAtom } from 'jotai'

import * as _consts from '../claim.consts'
import * as store from '@/store/'
import * as global_components from '@/components/global'
import * as utils from '@/utils'
import dropdown_svg from '@/assets/icons/dropdown.svg'
import { useRouter } from 'next/navigation'
import { useAccount, useConnections, useSwitchChain } from 'wagmi'

export function multilinkSuccessView({ txHash, claimDetails, senderAddress }: _consts.IClaimScreenProps) {
    const router = useRouter()
    const { isConnected, address, chain: currentChain } = useAccount()
    const connections = useConnections()
    const { switchChainAsync } = useSwitchChain()

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    const explorerUrlWithTx = useMemo(() => {
        return txHash.map((hash, idx) => {
            return utils.getExplorerUrl(chainDetails, claimDetails[idx].chainId) + +'/tx/' + hash
        })
    }, [chainDetails, claimDetails])

    const isw3mEmailWallet = useMemo(() => {
        return (
            connections.find((obj) => obj.accounts.includes((address ?? '') as `0x${string}`))?.connector.id ==
            'w3mEmail'
        )
    }, [connections, address])

    const checkNetwork = async (chainId: string) => {
        //check if the user is on the correct chain
        if (currentChain?.id.toString() !== chainId.toString()) {
            try {
                await switchChainAsync({ chainId: Number(chainId) })
            } catch (error) {
                console.error('Error switching network:', error)
            }
        }
    }

    useEffect(() => {
        if (isw3mEmailWallet && isConnected) {
            checkNetwork(claimDetails[0].chainId)
        }
    }, [isw3mEmailWallet])

    useEffect(() => {
        router.prefetch('/send')
        sendNotification()
    }, [])

    const sendNotification = async () => {
        const chainName = chainDetails.find((detail) => detail.chainId === claimDetails[0].chainId)?.name
        utils.sendNotification(senderAddress, address, chainName)
    }

    return (
        <>
            <h2 className="title-font mb-0 text-3xl font-black md:text-5xl">Congratulations!</h2>
            <p className="mb-0 mt-3 break-words text-center text-lg">You have successfully claimed all your funds.</p>
            <div
                className="mt-2 flex cursor-pointer items-center justify-center"
                onClick={() => {
                    setIsDropdownOpen(!isDropdownOpen)
                }}
            >
                <div className="cursor-pointer border-none bg-white text-sm  ">Check Transactions </div>
                <img
                    style={{
                        transform: isDropdownOpen ? 'scaleY(-1)' : 'none',
                        transition: 'transform 0.3s ease-in-out',
                    }}
                    src={dropdown_svg.src}
                    alt=""
                    className={'h-6 '}
                />
            </div>
            {isDropdownOpen && (
                <div className="m-2 flex flex-col items-center justify-center gap-2 text-center text-base sm:p-0">
                    {txHash.map((hash, idx) => (
                        <a
                            href={explorerUrlWithTx[idx] ?? ''}
                            target="_blank"
                            className="cursor-pointer break-all text-center text-sm font-bold text-black underline "
                            key={hash}
                        >
                            {utils.shortenHash(hash)}
                        </a>
                    ))}
                </div>
            )}

            <button
                className="mx-auto mb-4 mt-4 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    router.push('/send')
                }}
            >
                Send Crypto
            </button>

            <p className=" mt-4 text-center text-xs">
                Click{' '}
                <a
                    href="https://www.notion.so/peanutprotocol/EthLisbon-2023-Peanut-Hackathon-860313c93a57448fba82aec2c88ae19a"
                    target="_blank"
                    className="cursor-pointer text-black underline"
                >
                    here{' '}
                </a>
                to see what you can do with your EthLisbon welcome pack!
            </p>
            <p className="mt-4 text-center text-xs">
                Thoughts? Feedback? Use cases? Memes? Hit us up on{' '}
                <a href="https://discord.gg/BX9Ak7AW28" target="_blank" className="cursor-pointer text-black underline">
                    Discord
                </a>
                !
            </p>

            <global_components.PeanutMan type="presenting" />
        </>
    )
}
