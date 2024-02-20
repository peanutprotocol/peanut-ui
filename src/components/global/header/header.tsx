'use client'
import Link from 'next/link'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { Fragment } from 'react'
import { Disclosure, Menu, Transition } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

import * as utils from '@/utils'
import * as hooks from '@/hooks'

import peanut_logo from '@/assets/peanutman-logo.svg'
import triangle_svg from '@/assets/icons/triangle.svg'

function classNames(...classes: any) {
    return classes.filter(Boolean).join(' ')
}

export function Header({ showMarquee = true }: { showMarquee?: boolean }) {
    const { address, isConnected } = useAccount()
    const gaEventTracker = hooks.useAnalyticsEventTracker('header')

    const { open: web3modalOpen } = useWeb3Modal()

    return (
        <Disclosure as="nav" className="bg-black">
            {({ open }) => (
                <>
                    <div className="">
                        <div className="relative flex h-16 items-center justify-between">
                            <div className="absolute inset-y-0 left-0 flex w-full items-center justify-between sm:hidden">
                                <div
                                    className="flex h-full cursor-pointer items-center px-2  font-bold uppercase text-white no-underline hover:bg-white hover:text-black"
                                    onClick={() => {
                                        if (window.location.pathname == '/') window.location.reload()
                                        else window.location.href = '/'
                                    }}
                                >
                                    <img src={peanut_logo.src} alt="logo" className="h-6 sm:h-10" />
                                    <span className=" inline px-2 text-lg sm:px-6 sm:text-2xl">peanut protocol</span>
                                </div>
                                <Disclosure.Button className="relative inline-flex items-center justify-center border-none  bg-black p-2">
                                    <span className="sr-only">Open main menu</span>
                                    {open ? (
                                        <XMarkIcon className="block h-6 w-6 stroke-white" aria-hidden="true" />
                                    ) : (
                                        <Bars3Icon className="block h-6 w-6 stroke-white" aria-hidden="true" />
                                    )}
                                </Disclosure.Button>
                            </div>
                            <div className="flex hidden h-full flex-1 flex-row items-center justify-center sm:flex sm:items-stretch sm:justify-start">
                                <div
                                    className="flex h-full cursor-pointer items-center p-0 text-2xl font-bold uppercase text-white no-underline hover:bg-white hover:text-black"
                                    onClick={() => {
                                        if (window.location.pathname == '/') window.location.reload()
                                        else window.location.href = '/'
                                    }}
                                >
                                    <img src={peanut_logo.src} alt="logo" className="h-6 sm:h-10" />
                                    <span className="hidden lg:inline lg:px-6">peanut protocol</span>
                                </div>
                                <div className="hidden h-full items-center justify-center  sm:flex ">
                                    <div className="flex h-full items-center">
                                        <Menu as="div" className="relative h-full items-center justify-center ">
                                            <Menu.Button
                                                as="a"
                                                className="flex h-full cursor-pointer items-center px-1 text-base font-bold uppercase text-white no-underline hover:bg-white hover:text-black lg:px-8"
                                                aria-current={false ? 'page' : undefined}
                                            >
                                                APP
                                            </Menu.Button>
                                            <Transition
                                                as={Fragment}
                                                enter="transition ease-out duration-100"
                                                enterFrom="transform opacity-0 scale-95"
                                                enterTo="transform opacity-100 scale-100"
                                                leave="transition ease-in duration-75"
                                                leaveFrom="transform opacity-100 scale-100"
                                                leaveTo="transform opacity-0 scale-95"
                                            >
                                                <Menu.Items className="absolute left-0 z-10 w-48 origin-top-right bg-black p-0 text-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                                    {/* <img
                                                        src={triangle_svg.src}
                                                        className="absolute -top-4 left-8 h-4 w-4"
                                                    /> */}

                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <Link
                                                                href="/send"
                                                                className={classNames(
                                                                    active
                                                                        ? 'bg-white text-black'
                                                                        : 'bg-black text-white',
                                                                    'block px-4 py-2 text-sm no-underline'
                                                                )}
                                                            >
                                                                Create link
                                                            </Link>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <Link
                                                                href="/raffle/create"
                                                                className={classNames(
                                                                    active
                                                                        ? 'bg-white text-black'
                                                                        : 'bg-black text-white',
                                                                    'block px-4 py-2 text-sm  no-underline'
                                                                )}
                                                            >
                                                                Create raffle
                                                            </Link>
                                                        )}
                                                    </Menu.Item>
                                                </Menu.Items>
                                            </Transition>
                                        </Menu>

                                        <Disclosure.Button
                                            key={'docs'}
                                            as="a"
                                            href={'/docs'}
                                            className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold uppercase text-white no-underline hover:bg-white hover:text-black lg:px-8"
                                            aria-current={false ? 'page' : undefined}
                                        >
                                            DOCS
                                        </Disclosure.Button>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute inset-y-0 right-0 flex hidden items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:flex sm:pr-0">
                                <Link href={'/dashboard'} className="no-underline">
                                    <button className="brutalborder block h-full cursor-pointer bg-white p-1 text-center text-sm font-bold text-black hover:invert sm:px-4 sm:py-2 md:h-max lg:text-lg">
                                        Dashboard
                                    </button>
                                </Link>
                                <button
                                    id="connectButton"
                                    className="brutalborder block h-full cursor-pointer bg-white p-1 text-center text-sm font-bold text-black no-underline hover:invert sm:px-4 sm:py-2 md:mr-4 lg:text-lg"
                                    onClick={() => {
                                        web3modalOpen()
                                    }}
                                >
                                    {isConnected ? utils.shortenAddress(address ?? '') : 'Connect'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <Disclosure.Panel className="sm:hidden">
                        <div className="space-y-1 px-2 pb-3 pt-2">
                            <Disclosure>
                                {({ open }) => (
                                    <>
                                        <Disclosure.Button
                                            className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold text-white no-underline hover:bg-white hover:text-black lg:px-8"
                                            key="app"
                                            as="a"
                                        >
                                            App
                                        </Disclosure.Button>
                                        <Disclosure.Panel className="space-y-1 px-2 py-3">
                                            <a
                                                href="/send"
                                                className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold text-white no-underline hover:bg-white hover:text-black lg:px-8"
                                            >
                                                Create Link
                                            </a>
                                            <a
                                                href="/raffle/create"
                                                className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold text-white no-underline hover:bg-white hover:text-black lg:px-8"
                                            >
                                                Create Raffle
                                            </a>
                                        </Disclosure.Panel>
                                    </>
                                )}
                            </Disclosure>
                            <Disclosure.Button
                                key="docs"
                                as="a"
                                href={'/docs'}
                                className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold text-white no-underline hover:bg-white hover:text-black lg:px-8"
                            >
                                Docs
                            </Disclosure.Button>

                            <Disclosure.Button
                                key="dashboard"
                                as="a"
                                href={'/dashboard'}
                                className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold text-white no-underline hover:bg-white hover:text-black lg:px-8"
                            >
                                Dashboard
                            </Disclosure.Button>
                            <Disclosure.Button
                                key="connect"
                                as="a"
                                onClick={() => {
                                    web3modalOpen()
                                }}
                                className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold text-white no-underline hover:bg-white hover:text-black lg:px-8"
                            >
                                {isConnected ? utils.shortenAddress(address ?? '') : 'Connect'}
                            </Disclosure.Button>
                        </div>
                    </Disclosure.Panel>
                </>
            )}
        </Disclosure>
    )
}

// return (
//     <div>
//         <nav className="relative my-2 flex max-h-20 flex-wrap justify-between bg-black">
//             <div className="flex flex-grow items-center">
//                 <div
//                     className="flex h-full cursor-pointer items-center p-1 py-2 pl-1 text-2xl font-bold uppercase text-white no-underline hover:bg-white hover:text-black"
//                     onClick={() => {
//                         if (window.location.pathname == '/') window.location.reload()
//                         else window.location.href = '/'
//                     }}
//                 >
//                     <img src={peanut_logo.src} alt="logo" className="h-6 sm:h-10" />
//                     <span className="hidden lg:inline lg:px-6">peanut protocol</span>
//                 </div>

//                 <Link
//                     className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold uppercase text-white no-underline hover:bg-white hover:text-black lg:px-8"
//                     href={'/send'}
//                 >
//                     <span className="">app</span>
//                 </Link>

//                 <Link
//                     className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold uppercase text-white no-underline hover:bg-white hover:text-black lg:px-8"
//                     href={'https://docs.peanut.to'}
//                 >
//                     <span className="">docs</span>
//                 </Link>
//             </div>
//             <div className="mr-1 flex h-full gap-1 self-center sm:gap-4">
//                 <Link href={'/dashboard'} className="no-underline">
//                     <button className="brutalborder block h-full cursor-pointer bg-white p-1 text-center text-sm font-bold text-black hover:invert sm:px-4 sm:py-2 md:h-max lg:text-lg">
//                         Dashboard
//                     </button>
//                 </Link>
//                 <button
//                     id="connectButton"
//                     className="brutalborder block h-full cursor-pointer bg-white p-1 text-center text-sm font-bold text-black hover:invert sm:px-4 sm:py-2 md:mr-4 lg:text-lg"
//                     onClick={() => {
//                         open()
//                     }}
//                 >
//                     {isConnected ? utils.shortenAddress(address ?? '') : 'Connect'}
//                 </button>
//             </div>
//         </nav>
//         {/* {showMarquee && (
//             <global_components.MarqueeWrapper
//                 backgroundColor="bg-red"
//                 onClick={() => {
//                     window.open('https://peanutprotocol.gitbook.io/peanut-protocol-docs-1/overview/what-we-do')
//                 }}
//                 direction="right"
//             >
//                 <>
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         EXPERIMENTAL
//                     </div>
//                     <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
//                     <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
//                         x-chain
//                     </div>
//                     <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
//                 </>
//             </global_components.MarqueeWrapper>
//         )} */}
//     </div>
// )
