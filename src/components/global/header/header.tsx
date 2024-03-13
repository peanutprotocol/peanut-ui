'use client'
import Link from 'next/link'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Disclosure, Popover, Transition } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

import * as utils from '@/utils'
import * as hooks from '@/hooks'

import peanut_logo from '@/assets/peanut/peanutman-logo.svg'
import { useRouter } from 'next/navigation'

export function Header({ showMarquee = true }: { showMarquee?: boolean }) {
    const { address, isConnected } = useAccount()
    const { open: web3modalOpen } = useWeb3Modal()
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [openState, setOpenState] = useState(false)
    const router = useRouter()

    const onHover = (open: any, action: string) => {
        if ((!open && !openState && action === 'onMouseEnter') || (open && openState && action === 'onMouseLeave')) {
            setOpenState((openState) => !openState)
            buttonRef?.current?.click()
        }
    }

    const handleClickOutside = (event: any) => {
        if (buttonRef.current && !buttonRef.current.contains(event.target)) {
            event.stopPropagation()
        }
    }
    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    })

    return (
        <>
            <Disclosure as="nav" className="bg-black">
                {({ open }) => (
                    <>
                        <div className="">
                            <div className="relative flex h-16 items-center justify-between">
                                <div className="absolute inset-y-0 left-0 flex w-full items-center justify-between sm:hidden">
                                    <div
                                        className="flex h-full cursor-pointer items-center px-2  font-bold uppercase text-white no-underline hover:bg-white hover:text-black"
                                        onClick={() => {
                                            if (window?.location.pathname == '/') window?.location.reload()
                                            else window.location.href = '/'
                                        }}
                                    >
                                        <img src={peanut_logo.src} alt="logo" className="ml-2 h-6 sm:h-10" />
                                        <span className=" inline px-2 text-lg sm:px-6 sm:text-2xl">
                                            peanut protocol
                                        </span>
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
                                <div className="hidden h-full flex-1 flex-row items-center justify-center sm:flex sm:items-stretch sm:justify-start">
                                    <div
                                        className="flex h-full cursor-pointer items-center p-0 text-2xl font-bold uppercase text-white no-underline hover:bg-white hover:text-black"
                                        onClick={() => {
                                            if (window.location.pathname == '/') window.location.reload()
                                            else window.location.href = '/'
                                        }}
                                    >
                                        <img src={peanut_logo.src} alt="logo" className="ml-2 h-6 sm:h-10" />
                                        <span className="inline sm:px-6">peanut protocol</span>
                                    </div>
                                    <div className="hidden h-full items-center justify-center  sm:flex ">
                                        <div className="flex h-full items-center">
                                            <Popover className={'h-full'}>
                                                {({ open }) => (
                                                    <div
                                                        onMouseEnter={() => onHover(open, 'onMouseEnter')}
                                                        onMouseLeave={() => onHover(open, 'onMouseLeave')}
                                                        className="relative h-full items-center justify-center "
                                                    >
                                                        <Popover.Button
                                                            className="flex h-full cursor-pointer items-center border-none bg-black px-1 text-base font-bold uppercase text-white no-underline hover:bg-white hover:text-black md:px-8"
                                                            ref={buttonRef}
                                                            onClick={(event: any) => {
                                                                if (event?.detail != 0) {
                                                                    router.push('/send')
                                                                    event.preventDefault()
                                                                } else {
                                                                }
                                                            }}
                                                        >
                                                            APP
                                                        </Popover.Button>

                                                        <Transition
                                                            show={open}
                                                            as={Fragment}
                                                            enter="transition ease-out duration-0"
                                                            enterFrom="transform opacity-0 scale-95"
                                                            enterTo="transform opacity-100 scale-100"
                                                            leave="transition ease-in duration-0"
                                                            leaveFrom="transform opacity-100 scale-100"
                                                            leaveTo="transform opacity-0 scale-95"
                                                        >
                                                            <Popover.Panel className="absolute left-0 z-10 w-48 origin-top-right bg-black p-0 uppercase text-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                                                <Link
                                                                    href="/send"
                                                                    className={
                                                                        'hover: block bg-black px-4 py-2 text-base text-black text-white no-underline hover:bg-white hover:text-black'
                                                                    }
                                                                >
                                                                    Transfer
                                                                </Link>
                                                                <Link
                                                                    href="/raffle/create"
                                                                    className={
                                                                        'hover: block bg-black px-4 py-2 text-base text-black text-white no-underline hover:bg-white hover:text-black'
                                                                    }
                                                                >
                                                                    Raffle
                                                                </Link>
                                                            </Popover.Panel>
                                                        </Transition>
                                                    </div>
                                                )}
                                            </Popover>

                                            <Disclosure.Button
                                                key={'docs'}
                                                as="a"
                                                href={'/docs'}
                                                className="flex h-full cursor-pointer items-center px-1 text-base font-bold uppercase text-white no-underline hover:bg-white hover:text-black md:px-8"
                                            >
                                                DOCS
                                            </Disclosure.Button>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute inset-y-0 right-0 flex hidden items-center gap-2 pr-2 sm:static sm:inset-auto sm:ml-6 sm:flex sm:pr-0">
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
                                                className="flex h-full cursor-pointer items-center border-none bg-black px-1 py-2 text-base font-bold text-white no-underline hover:bg-white hover:text-black lg:px-8"
                                                key="app"
                                            >
                                                App
                                            </Disclosure.Button>
                                            <Disclosure.Panel className="space-y-1 px-2 ">
                                                <a
                                                    href="/send"
                                                    className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold text-white no-underline hover:bg-white hover:text-black lg:px-8"
                                                >
                                                    Transfer
                                                </a>
                                                <a
                                                    href="/raffle/create"
                                                    className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold text-white no-underline hover:bg-white hover:text-black lg:px-8"
                                                >
                                                    Raffle
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
            {/* <div className="brutalborder-bottom border-black bg-yellow p-2 text-center text-black"> */}
            <div className="brutalborder-bottom border-black bg-yellow p-2 text-center ">
                <a
                    href="https://peanutprotocol.notion.site/TS-Fullstack-Nut-93f621339f744c9b8054a8140d2c06ea?pvs=74"
                    className="text-md font-bold lowercase text-black"
                >
                    We're hiring!
                </a>
            </div>
        </>
    )
}
