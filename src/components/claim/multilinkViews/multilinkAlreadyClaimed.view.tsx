import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useMemo, useState, Fragment } from 'react'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'
import { useAtom } from 'jotai'
import peanut from '@squirrel-labs/peanut-sdk'
import { useForm } from 'react-hook-form'
import { Dialog, Transition } from '@headlessui/react'

import * as global_components from '@/components/global'
import * as _consts from '../claim.consts'
import * as utils from '@/utils'
import * as store from '@/store'
import * as consts from '@/consts'
import * as interfaces from '@/interfaces'
import dropdown_svg from '@/assets/dropdown.svg'
import peanutman_logo from '@/assets/peanutman-logo.svg'

export function multilinkAlreadyClaimedView({ claimDetails }: { claimDetails: interfaces.ILinkDetails[] }) {
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

    return (
        <>
            <>
                <h2 className="mb-0 mt-2 py-6 text-center text-2xl font-black lg:text-4xl">
                    This link has already been claimed!
                </h2>
                <h3 className="text-md my-1 text-center font-normal sm:text-lg lg:text-xl ">
                    This link used to contain the following tokens:
                </h3>

                <div className="mb-6 mt-2 flex flex-col gap-2 ">
                    {claimDetails.map((link, idx) => {
                        return (
                            <div className="flex items-center gap-2" key={idx}>
                                <img src={peanutman_logo.src} className="h-6 w-6" />
                                {link.tokenType == 2 ? (
                                    <label
                                        className={
                                            'text-md my-1 cursor-pointer text-center font-normal underline sm:text-lg lg:text-xl '
                                        }
                                    >
                                        NFT on{' '}
                                        {chainDetails &&
                                            chainDetails.find((chain) => chain.chainId == link.chainId)?.name}
                                    </label>
                                ) : (
                                    <label className={'text-md my-1 text-center font-normal sm:text-lg lg:text-xl '}>
                                        {link.tokenSymbol} on{' '}
                                        {chainDetails &&
                                            chainDetails.find((chain) => chain.chainId == link.chainId)?.name}
                                    </label>
                                )}
                            </div>
                        )
                    })}
                </div>
                <p className="mx-14 mt-4 text-center text-base">
                    Want to send tokens via links yourself? Try now or proceed to the EthRome hacker manual.
                </p>

                <div className="mt-8 flex w-3/4 justify-center space-x-4 p-2">
                    <a
                        href="/send"
                        id="cta-btn"
                        className="mb-2 block bg-white p-5 text-center text-2xl font-black md:w-3/5 lg:w-1/3"
                    >
                        Try Now
                    </a>

                    <a
                        href="/https://ethrome.notion.site/ETHRome-Hacker-Manual-e3aa8b443a84426186eede13b0ae8709"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-5 text-2xl font-black text-black no-underline hover:underline"
                    >
                        Hacker Manual →
                    </a>
                </div>
            </>

            <global_components.PeanutMan type="sad" />
        </>
    )
}
