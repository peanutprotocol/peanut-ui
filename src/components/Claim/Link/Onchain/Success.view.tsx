import Icon from '@/components/Global/Icon'
import * as _consts from '../../Claim.consts'
import * as utils from '@/utils'
import * as context from '@/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useAccount, useConnections, useSwitchChain } from 'wagmi'
import { fetchDestinationChain } from '@/components/utils/utils'

export const SuccessClaimLinkView = ({ transactionHash, claimLinkData, type }: _consts.IClaimScreenProps) => {
    const connections = useConnections()
    const { isConnected, address, chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()

    const { resetTokenContextProvider, selectedChainID } = useContext(context.tokenSelectorContext)

    const explorerUrlWithTx = useMemo(
        () => `${utils.getExplorerUrl(claimLinkData.chainId)}/tx/${transactionHash}`,
        [transactionHash, claimLinkData.chainId]
    )
    const explorerUrlAxelarWithTx = 'https://axelarscan.io/gmp/' + transactionHash

    const [explorerUrlDestChainWithTxHash, setExplorerUrlDestChainWithTxHash] = useState<
        { transactionId: string; transactionUrl: string } | undefined
    >(undefined)

    const isw3mEmailWallet = useMemo(() => {
        return (
            connections.find((obj) => obj.accounts.includes((address ?? '') as `0x${string}`))?.connector.id ==
            'w3mAuth'
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
        resetTokenContextProvider()
        if (transactionHash && type === 'claimxchain') {
            fetchDestinationChain(transactionHash, setExplorerUrlDestChainWithTxHash)
        }
    }, [])

    useEffect(() => {
        if (isw3mEmailWallet && isConnected) {
            const chainId = type === 'claimxchain' ? selectedChainID : claimLinkData.chainId
            checkNetwork(chainId)
        }
    }, [isw3mEmailWallet])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Yay!</label>
            <label className="text-h8 font-bold ">You have successfully claimed your funds!</label>
            <div className="flex w-full flex-col items-start justify-center gap-1.5">
                <label className="text-h8 font-normal text-gray-1">Transaction details</label>
                {type === 'claimxchain' ? (
                    <div className="flex flex-col items-start justify-center gap-1 text-h9  font-normal">
                        <div className="flex w-full flex-row items-center justify-start gap-1">
                            <label className="">Source chain:</label>
                            <Link className="cursor-pointer  underline" href={explorerUrlWithTx}>
                                {utils.shortenAddressLong(transactionHash ?? '')}
                            </Link>
                        </div>
                        <div className="flex w-full flex-row items-center justify-start gap-1">
                            <label className="">Axelar:</label>

                            <Link className="cursor-pointer  underline" href={explorerUrlAxelarWithTx}>
                                {utils.shortenAddressLong(transactionHash ?? '')}
                            </Link>
                        </div>
                        <div className="flex w-full flex-row  items-center justify-start gap-1">
                            <label className="">Destination Chain</label>
                            {!explorerUrlDestChainWithTxHash ? (
                                <div className="h-2 w-16 animate-colorPulse rounded bg-slate-700"></div>
                            ) : (
                                <Link
                                    className="cursor-pointer  underline"
                                    href={explorerUrlDestChainWithTxHash.transactionUrl}
                                >
                                    {utils.shortenAddressLong(explorerUrlDestChainWithTxHash.transactionId ?? '')}
                                </Link>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex w-full flex-row items-center justify-start gap-1">
                        <label className="text-h9">Transaction hash:</label>
                        <Link className="cursor-pointer text-h9 font-normal underline" href={explorerUrlWithTx}>
                            {utils.shortenAddressLong(transactionHash ?? '')}
                        </Link>
                    </div>
                )}
            </div>
            <label className="text-h9 font-normal">
                We would like to hear from your experience. Hit us up on{' '}
                <a
                    className="cursor-pointer text-black underline dark:text-white"
                    target="_blank"
                    href="https://discord.gg/BX9Ak7AW28"
                >
                    Discord!
                </a>
            </label>
            <Link
                className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                href={'/profile'}
            >
                <div className=" border border-n-1 p-0 px-1">
                    <Icon name="profile" className="-mt-0.5" />
                </div>
                See your payments.
            </Link>
        </div>
    )
}

