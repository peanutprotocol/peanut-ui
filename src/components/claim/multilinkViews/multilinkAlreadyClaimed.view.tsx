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
    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const [isNftModalOpen, setIsNftModalOpen] = useState(false)
    const [selectedNftIdx, setSelectedNftIdx] = useState<number>(0)

    return (
        <>
            <>
                <h2 className="mb-0 mt-2 text-center text-2xl font-black lg:text-4xl ">
                    This link has already been claimed!
                </h2>
                <h3 className="text-md my-1 text-center font-black sm:text-lg lg:text-xl ">
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
                                            'text-md my-1 cursor-pointer text-center font-black underline sm:text-lg lg:text-xl '
                                        }
                                        onClick={() => {
                                            setSelectedNftIdx(idx)
                                            setIsNftModalOpen(true)
                                        }}
                                    >
                                        NFT on{' '}
                                        {chainDetails &&
                                            chainDetails.find((chain) => chain.chainId == link.chainId)?.name}
                                    </label>
                                ) : (
                                    <label className={'text-md my-1 text-center font-black sm:text-lg lg:text-xl '}>
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
                    Want to know what you can do with your ETHRome welcome package? Click{' '}
                    <a href="https://ethrome.notion.site/ETHRome-Hacker-Manual-e3aa8b443a84426186eede13b0ae8709" target="_blank" className="cursor-pointer text-black underline">
                        here
                    </a>{' '}
                    to find out!
                </p>
            </>

            <global_components.PeanutMan type="sad" />
        </>
    )
}
