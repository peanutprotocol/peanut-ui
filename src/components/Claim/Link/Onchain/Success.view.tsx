import StatusViewWrapper from '@/components/Global/StatusViewWrapper'
import { fetchDestinationChain } from '@/components/utils/utils'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { getExplorerUrl, shortenAddressLong } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useConnections, useSwitchChain } from 'wagmi'
import * as _consts from '../../Claim.consts'
import { useAccount } from 'wagmi'
import { sendLinksApi, ESendLinkStatus } from '@/services/sendLinks'

export const SuccessClaimLinkView = ({
    transactionHash,
    setTransactionHash,
    claimLinkData,
    type,
}: _consts.IClaimScreenProps) => {
    const connections = useConnections()
    const { isConnected: isPeanutWallet, address } = useWallet()
    const { chain: currentChain, address: wagmiAddress, isConnected: isWagmiConnected } = useAccount()
    const { switchChainAsync } = useSwitchChain()

    const { resetTokenContextProvider, selectedChainID } = useContext(tokenSelectorContext)

    const isConnected = useMemo(() => isPeanutWallet || isWagmiConnected, [isPeanutWallet, isWagmiConnected])

    const explorerUrlWithTx = useMemo(
        () => `${getExplorerUrl(claimLinkData.chainId)}/tx/${transactionHash}`,
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
                Sentry.captureException(error)
                console.error('Error switching network:', error)
            }
        }
    }

    useEffect(() => {
        if (!isPeanutWallet) resetTokenContextProvider()
        if (transactionHash && type === 'claimxchain') {
            //TODO: change when adding claimlink history
            fetchDestinationChain(transactionHash, setExplorerUrlDestChainWithTxHash)
        }
    }, [isPeanutWallet, transactionHash, type])

    useEffect(() => {
        if (!!transactionHash) return

        const fetchClaimData = async () => {
            try {
                const link = await sendLinksApi.get(claimLinkData.link)
                if (link.claim) {
                    setTransactionHash(link.claim?.txHash)
                    return true
                } else if (link.status === ESendLinkStatus.FAILED) {
                    return true
                }
                return false
            } catch (error) {
                console.error('Error fetching claim data:', error)
                return false
            }
        }

        const intervalId = setInterval(async () => {
            const claimFound = await fetchClaimData()
            if (claimFound) {
                clearInterval(intervalId)
            }
        }, 250)

        // Initial fetch attempt
        fetchClaimData()

        // Clean up the interval when component unmounts or transactionHash changes
        return () => clearInterval(intervalId)
    }, [transactionHash, claimLinkData.link])

    useEffect(() => {
        if (isw3mEmailWallet && isConnected) {
            const chainId = type === 'claimxchain' ? selectedChainID : claimLinkData.chainId
            checkNetwork(chainId)
        }
    }, [isw3mEmailWallet])

    return (
        <StatusViewWrapper title="Yay!" description="You have successfully claimed your funds!">
            <div className="flex flex-col gap-2">
                <label className="text-start text-h8 text-grey-1">Transaction details</label>
                {type === 'claimxchain' && (
                    <div className="flex flex-col items-start justify-center gap-1 text-h9  font-normal">
                        <div className="flex w-full flex-row items-center justify-between gap-1">
                            <label className="text-h9">Source chain:</label>
                            <Link className="cursor-pointer  underline" href={explorerUrlWithTx}>
                                {shortenAddressLong(transactionHash ?? '')}
                            </Link>
                        </div>
                        <div className="flex w-full flex-row items-center justify-between gap-1">
                            <label className="text-h9">Cross-chain Routing via Axelar:</label>

                            <Link className="cursor-pointer  underline" href={explorerUrlAxelarWithTx}>
                                {shortenAddressLong(transactionHash ?? '')}
                            </Link>
                        </div>
                        <div className="flex w-full flex-row  items-center justify-between gap-1">
                            <label className="text-h9">Destination Address:</label>
                            {!explorerUrlDestChainWithTxHash ? (
                                <div className="h-2 w-16 animate-colorPulse rounded bg-slate-700"></div>
                            ) : (
                                <Link
                                    className="cursor-pointer underline"
                                    href={explorerUrlDestChainWithTxHash.transactionUrl}
                                >
                                    {shortenAddressLong(explorerUrlDestChainWithTxHash.transactionId ?? '')}
                                </Link>
                            )}
                        </div>
                    </div>
                )}
                <div className="flex w-full flex-row items-center justify-between gap-1">
                    <label className="text-h9">Transaction hash:</label>
                    {transactionHash ? (
                        <Link className="cursor-pointer text-h9 font-normal underline" href={explorerUrlWithTx}>
                            {shortenAddressLong(transactionHash ?? '')}
                        </Link>
                    ) : (
                        <div className="h-2 w-16 animate-colorPulse rounded bg-slate-700"></div>
                    )}
                </div>
            </div>
        </StatusViewWrapper>
    )
}
