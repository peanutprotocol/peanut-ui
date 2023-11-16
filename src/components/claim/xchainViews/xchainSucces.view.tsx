import { useEffect, useMemo, useState } from 'react'
import { useAtom } from 'jotai'

import * as _consts from '../claim.consts'
import * as store from '@/store/'
import * as global_components from '@/components/global'
import * as hooks from '@/hooks'
import dropdown_svg from '@/assets/dropdown.svg'
import { useRouter } from 'next/navigation'
import * as utils from '@/utils'
import { peanut } from '@squirrel-labs/peanut-sdk'
import axios from 'axios'
import checkbox from '@/assets/checkbox.svg'

export function xchainSuccesView({ txHash, crossChainSuccess, claimDetails }: _consts.IClaimScreenProps) {
    const router = useRouter()
    const gaEventTracker = hooks.useAnalyticsEventTracker('claim-component')

    const [isDropdownOpen, setIsDropdownOpen] = useState(true)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    const explorerUrlSrcChainWithTxHash = useMemo(
        () =>
            chainDetails.find((detail) => detail.chainId === claimDetails[0].chainId)?.explorers[0].url +
            '/tx/' +
            txHash[0],
        [txHash, chainDetails]
    )

    const isTestnet = !Object.keys(peanut.CHAIN_DETAILS)
        .map((key) => peanut.CHAIN_DETAILS[key as keyof typeof peanut.CHAIN_DETAILS])
        .find((chain) => chain.chainId == claimDetails[0].chainId)?.mainnet

    const explorerUrlAxelarWithTxHash = useMemo(
        () =>
            crossChainSuccess && isTestnet
                ? 'https://testnet.axelarscan.io/gmp/' + txHash[0]
                : 'https://axelarscan.io/gmp/' + txHash[0],
        [txHash, chainDetails]
    )

    const [explorerUrlDestChainWithTxHash, setExplorerUrlDestChainWithTxHash] = useState<
        { transactionId: string; transactionUrl: string } | undefined
    >(undefined)

    async function checkTransactionStatus(txHash: string): Promise<void> {
        try {
            const response = await axios.get(
                isTestnet
                    ? 'https://testnet.v2.api.squidrouter.com/v2/status'
                    : 'https://v2.api.squidrouter.com/v2/status',
                {
                    params: { transactionId: txHash },
                    headers: { 'x-integrator-id': 'peanut-ui' },
                }
            )
            return response.data
        } catch (error) {
            console.error('Error fetching transaction status:', error)
            throw error
        }
    }

    async function loopUntilSuccess(txHash: string) {
        let intervalId = setInterval(async () => {
            const result = await checkTransactionStatus(txHash)

            //@ts-ignore
            if (result.squidTransactionStatus === 'success') {
                setExplorerUrlDestChainWithTxHash({
                    //@ts-ignore
                    transactionUrl: result.toChain.transactionUrl,
                    //@ts-ignore
                    transactionId: result.toChain.transactionId,
                })
                clearInterval(intervalId)
            } else {
                console.log('Checking status again...')
            }
        }, 5000)
    }

    useEffect(() => {
        router.prefetch('/send')
        gaEventTracker('peanut-x-chain-claimed', 'success')
        if (txHash && crossChainSuccess) {
            loopUntilSuccess(txHash[0])
        }
    }, [])

    return (
        <>
            <h2 className="title-font mb-0 text-3xl font-black md:text-5xl">Congratulations!</h2>
            {crossChainSuccess ? (
                <>
                    <p className="mb-0 mt-3 break-words text-center text-lg">
                        you have successfully cross-claimed your funds to {crossChainSuccess.chainName}!
                    </p>
                </>
            ) : (
                <>
                    {' '}
                    <p className="mb-0 mt-3 break-words text-center text-lg">
                        you have successfully claimed your funds!{' '}
                    </p>
                </>
            )}

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
            {isDropdownOpen ? (
                crossChainSuccess ? (
                    <div className="m-2 flex flex-col items-center justify-center gap-2 text-center text-base sm:p-0">
                        <div className="flex items-center gap-2">
                            source chain:{' '}
                            <a
                                href={explorerUrlSrcChainWithTxHash ?? ''}
                                target="_blank"
                                className="cursor-pointer break-all text-center text-sm font-medium text-black underline "
                            >
                                {utils.shortenHash(txHash[0])}
                            </a>
                            <img src={checkbox.src} className="h-4" />
                        </div>
                        <div className="flex items-center gap-2">
                            axelar transaction:{' '}
                            <a
                                href={explorerUrlAxelarWithTxHash ?? ''}
                                target="_blank"
                                className="cursor-pointer break-all text-center text-sm font-medium text-black underline "
                            >
                                {utils.shortenHash(txHash[0])}
                            </a>
                            {explorerUrlDestChainWithTxHash ? (
                                <img src={checkbox.src} className="h-4" />
                            ) : (
                                <div className="flex justify-center gap-1">
                                    <span className="bouncing-dots flex">
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                    </span>
                                </div>
                            )}
                        </div>
                        {explorerUrlDestChainWithTxHash && (
                            <div className="flex items-center gap-2">
                                destination chain:{' '}
                                <a
                                    href={explorerUrlDestChainWithTxHash.transactionUrl ?? ''}
                                    target="_blank"
                                    className="cursor-pointer break-all text-center text-sm font-medium text-black underline "
                                >
                                    {utils.shortenHash(explorerUrlDestChainWithTxHash.transactionId)}
                                </a>
                                <img src={checkbox.src} className="h-4" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        transaction hash:{' '}
                        <a
                            href={explorerUrlSrcChainWithTxHash ?? ''}
                            target="_blank"
                            className="cursor-pointer break-all text-center text-sm font-bold text-black underline "
                        >
                            {utils.shortenHash(txHash[0])}
                        </a>
                        <img src={checkbox.src} className="h-4" />
                    </div>
                )
            ) : (
                ''
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
