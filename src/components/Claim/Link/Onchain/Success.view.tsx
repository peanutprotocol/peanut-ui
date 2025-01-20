import { Button, Card } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import { fetchDestinationChain } from '@/components/utils/utils'
import * as context from '@/context'
import { useWallet } from '@/hooks/useWallet'
import * as utils from '@/utils'
import Link from 'next/link'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useConnections, useSwitchChain } from 'wagmi'
import * as _consts from '../../Claim.consts'

export const SuccessClaimLinkView = ({ transactionHash, claimLinkData, type }: _consts.IClaimScreenProps) => {
    const connections = useConnections()
    const { isConnected, address, chain: currentChain, isPeanutWallet } = useWallet()
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
        if (!isPeanutWallet) resetTokenContextProvider()
        if (transactionHash && type === 'claimxchain') {
            fetchDestinationChain(transactionHash, setExplorerUrlDestChainWithTxHash)
        }
    }, [isPeanutWallet, transactionHash, type])

    useEffect(() => {
        if (isw3mEmailWallet && isConnected) {
            const chainId = type === 'claimxchain' ? selectedChainID : claimLinkData.chainId
            checkNetwork(chainId)
        }
    }, [isw3mEmailWallet])

    return (
        <Card className="shadow-none sm:shadow-primary-4">
            <Card.Header className="mx-auto">
                <Card.Title className="mx-auto text-center">Yay!</Card.Title>
                <Card.Description className="mx-auto text-center">
                    You have successfully claimed your funds!
                </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-2">
                <label className="text-grey-1 text-center text-h8 font-normal">Transaction details</label>
                {type === 'claimxchain' && (
                    <div className="flex flex-col items-start justify-center gap-1 text-h9  font-normal">
                        <div className="flex w-full flex-row items-center justify-between gap-1">
                            <label className="">Source chain:</label>
                            <Link className="cursor-pointer  underline" href={explorerUrlWithTx}>
                                {utils.shortenAddressLong(transactionHash ?? '')}
                            </Link>
                        </div>
                        <div className="flex w-full flex-row items-center justify-between gap-1">
                            <label className="">Cross-chain Routing via Axelar:</label>

                            <Link className="cursor-pointer  underline" href={explorerUrlAxelarWithTx}>
                                {utils.shortenAddressLong(transactionHash ?? '')}
                            </Link>
                        </div>
                        <div className="flex w-full flex-row  items-center justify-between gap-1">
                            <label className="">Destination Address:</label>
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
                )}
                <Link className="w-full" target="_blank" href={`${explorerUrlWithTx}`}>
                    <Button variant="dark">
                        Transaction hash
                        <Icon name="external" className="fill-grey-1 h-4" />
                    </Button>
                </Link>
                <Link className="" href={'/profile'}>
                    <Button variant="stroke" className="text-nowrap">
                        <div className="border border-n-1 p-0 px-1">
                            <Icon name="profile" className="-mt-0.5" />
                        </div>
                        See your payments.
                    </Button>
                </Link>
                <label className="text-center text-h9 font-normal">
                    We would like to hear from your experience. Hit us up on{' '}
                    <a
                        className="cursor-pointer text-black underline dark:text-white"
                        target="_blank"
                        href="https://discord.gg/BX9Ak7AW28"
                    >
                        Discord!
                    </a>
                </label>
            </Card.Content>
        </Card>
    )
}
