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

const multiLinkDetails: interfaces.ILinkDetails[] = [
    {
        link: 'http://localhost:3000/claim#?c=137&v=v4&i=231&p=9X5d0JmWIbRdx8G4&t=ui',
        chainId: 137,
        depositIndex: 231,
        contractVersion: 'v4',
        password: '9X5d0JmWIbRdx8G4',
        tokenType: 0,
        tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.1',
        claimed: false,
        depositDate: '2023-09-19T09:08:46.000Z',
    },
    {
        link: 'http://localhost:3000/claim#?c=137&v=v4&i=231&p=9X5d0JmWIbRdx8G4&t=ui',
        chainId: 137,
        depositIndex: 231,
        contractVersion: 'v4',
        password: '9X5d0JmWIbRdx8G4',
        tokenType: 0,
        tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '0.1',
        claimed: false,
        depositDate: '2023-09-19T09:08:46.000Z',
    },
    {
        link: 'http://localhost:3000/claim#?c=137&v=v4&i=231&p=9X5d0JmWIbRdx8G4&t=ui',
        chainId: 137,
        depositIndex: 231,
        contractVersion: 'v4',
        password: '9X5d0JmWIbRdx8G4',
        tokenType: 2,
        tokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        tokenSymbol: 'MATIC',
        tokenName: 'MATIC',
        tokenAmount: '1',
        claimed: false,
        depositDate: '2023-09-19T09:08:46.000Z',
    },
]
export function multilinkAlreadyClaimedView() {
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
                    {multiLinkDetails.map((link, idx) => {
                        return (
                            <div className="flex items-center gap-2">
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
                                        {link.tokenAmount} {link.tokenSymbol} on{' '}
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
                    <a
                        href="https://discord.gg/BX9Ak7AW28"
                        target="_blank"
                        className="cursor-pointer text-black underline"
                    >
                        here
                    </a>{' '}
                    to find out!
                </p>
            </>

            <global_components.PeanutMan type="sad" />

            <Transition.Root show={isNftModalOpen} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setIsNftModalOpen(false)
                    }}
                >
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
                    </Transition.Child>

                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full min-w-full items-end justify-center text-center sm:items-center ">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                <Dialog.Panel className="brutalborder relative min-h-[240px] w-full transform overflow-hidden rounded-lg rounded-none bg-white pt-5 text-left text-black shadow-xl transition-all sm:mt-8 sm:min-h-[380px] sm:w-auto sm:min-w-[420px] sm:max-w-[420px] ">
                                    <div className="flex flex-col gap-4">
                                        <div>{multiLinkDetails[selectedNftIdx].chainId}</div>
                                        <img src={peanutman_logo.src} className="24 h-24" />
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>
        </>
    )
}
