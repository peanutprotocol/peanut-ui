import { useEffect, useMemo, useState } from 'react'
import { useAtom } from 'jotai'

import * as _consts from '../claim.consts'
import * as store from '@/store/'
import * as global_components from '@/components/global'
import * as hooks from '@/hooks'
import dropdown_svg from '@/assets/dropdown.svg'
import { useRouter } from 'next/navigation'

export function xchainSuccesView({ txHash, crossChainSuccess, claimDetails }: _consts.IClaimScreenProps) {
    const router = useRouter()
    const gaEventTracker = hooks.useAnalyticsEventTracker('claim-component')

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    const explorerUrlWithTx = useMemo(
        () =>
            crossChainSuccess
                ? 'https://testnet.axelarscan.io/gmp/' + txHash[0]
                : chainDetails.find((detail) => detail.chainId === claimDetails[0].chainId)?.explorers[0].url +
                  '/tx/' +
                  txHash[0],
        [txHash, chainDetails]
    )

    useEffect(() => {
        router.prefetch('/send')
        gaEventTracker('peanut-x-chain-claimed', 'success')
    }, [])

    return (
        <>
            <h2 className="title-font mb-0 text-3xl font-black md:text-5xl">Congratulations!</h2>
            {crossChainSuccess ? (
                <>
                    <p className="mb-0 mt-3 break-words text-center text-lg">
                        you have successfully cross-claimed your funds!{' '}
                    </p>
                    <p className="mb-0 mt-3 break-words text-center text-lg">
                        your funds will arive shortly on {crossChainSuccess.chainName}!
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
            {isDropdownOpen && (
                <div className="m-2 flex flex-col items-center justify-center gap-2 text-center text-base sm:p-0">
                    <a
                        href={explorerUrlWithTx ?? ''}
                        target="_blank"
                        className="cursor-pointer break-all text-center text-sm font-bold text-black underline "
                    >
                        {txHash[0]}
                    </a>
                    <p className="m-0">
                        <small>
                            Click the confirmation above and check <b>Internal Txs</b>. It might be slow.
                        </small>
                    </p>
                    <p className="m-0">
                        <small>If you don't see the funds in your wallet, make sure you are on the right chain.</small>
                    </p>
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
