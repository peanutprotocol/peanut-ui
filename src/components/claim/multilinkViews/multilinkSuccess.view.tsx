import { useEffect, useMemo, useState } from 'react'
import { useAtom } from 'jotai'

import * as _consts from '../claim.consts'
import * as store from '@/store/'
import * as global_components from '@/components/global'
import * as hooks from '@/hooks'
import * as utils from '@/utils'
import dropdown_svg from '@/assets/dropdown.svg'
import { useRouter } from 'next/navigation'

export function multilinkSuccessView({ txHash, claimDetails }: _consts.IClaimScreenProps) {
    const router = useRouter()
    const gaEventTracker = hooks.useAnalyticsEventTracker('claim-component')

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    const explorerUrlWithTx = useMemo(() => {
        return txHash.map((hash, idx) => {
            const chainDetail = chainDetails.find((cd) => cd.chainId === claimDetails[idx].chainId)
            return chainDetail?.explorers[0].url + '/tx/' + hash
        })
    }, [chainDetails, claimDetails])

    useEffect(() => {
        router.prefetch('/send')
        gaEventTracker('peanut-claimed', 'success')
    }, [])

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
            {/* TODO: implement ethrome trackid */}
            {true ? (
                <p className="mx-14 mt-4 text-center text-base">
                    Want to know what you can do with your ETHRome welcome package? Click{' '}
                    <a
                        href="https://ethrome.notion.site/ETHRome-Hacker-Manual-e3aa8b443a84426186eede13b0ae8709"
                        target="_blank"
                        className="cursor-pointer text-black underline"
                    >
                        here
                    </a>{' '}
                    to find out!
                </p>
            ) : (
                <button
                    className="mx-auto mb-4 mt-4 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                    id="cta-btn"
                    onClick={() => {
                        router.push('/send')
                    }}
                >
                    Send Crypto
                </button>
            )}

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
