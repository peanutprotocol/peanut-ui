'use client'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Disclosure, Popover, Transition } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'
import Link from 'next/link'

import * as assets from '@/assets'
import * as utils from '@/utils'

type HeaderProps = {}

const apps = [
    {
        name: 'Transfer',
        href: '/send',
    },
    {
        name: 'Raffle',
        href: '/raffle/create',
    },
    {
        name: 'Batch',
        href: '/batch/create',
    },
]

const Header = ({}: HeaderProps) => {
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
        <Disclosure
            as="nav"
            className="z-20 border-b border-n-1 bg-background dark:border-white dark:bg-n-2 md:!bg-transparent"
        >
            {({ open }) => (
                <>
                    <div className="relative flex h-16 items-center justify-between">
                        <div className="absolute left-0 flex w-full items-center justify-between sm:hidden">
                            <div
                                className="flex h-full cursor-pointer items-center px-2 font-bold uppercase"
                                onClick={() => {
                                    if (window?.location.pathname == '/') window?.location.reload()
                                    else window.location.href = '/'
                                }}
                            >
                                <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="ml-2 h-6 sm:h-10" />
                                <span className="inline px-2 text-h5 sm:px-6">peanut protocol</span>
                            </div>
                            <Disclosure.Button className="bg-transparant relative inline-flex items-center justify-center border-none p-2">
                                <span className="sr-only">Open main menu</span>
                                {open ? (
                                    <XMarkIcon
                                        className="block h-6 w-6 stroke-black dark:stroke-white"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Bars3Icon
                                        className="block h-6 w-6 stroke-black dark:stroke-white"
                                        aria-hidden="true"
                                    />
                                )}
                            </Disclosure.Button>
                        </div>
                        <div className="hidden h-full flex-1 flex-row items-center justify-center sm:flex sm:items-stretch sm:justify-start">
                            <div
                                className="flex h-full cursor-pointer items-center p-0 font-bold uppercase hover:bg-black hover:text-white dark:hover:bg-background dark:hover:text-black"
                                onClick={() => {
                                    if (window.location.pathname == '/') window.location.reload()
                                    else window.location.href = '/'
                                }}
                            >
                                <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="ml-2 h-6 sm:h-10" />
                                <span className="inline px-6 text-h4 font-bold">peanut protocol</span>
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
                                                    className={`bg-transparant flex h-full items-center border-none px-1 text-base text-h6 hover:bg-black hover:text-white focus:outline-none active:border-none dark:hover:bg-background dark:hover:text-black md:px-8 ${open && 'bg-black text-white dark:bg-background dark:text-black'}`}
                                                    ref={buttonRef}
                                                    onClick={(event: any) => {
                                                        if (event?.detail != 0) {
                                                            if (window?.location.pathname == '/send')
                                                                window?.location.reload()
                                                            else router.push('/send')
                                                            event.preventDefault()
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
                                                    <Popover.Panel className="absolute left-0 z-10 w-48 origin-top-right bg-black p-0 font-medium uppercase text-white no-underline shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                                        {apps.map((app) => (
                                                            <Link
                                                                key={app.name}
                                                                href={app.href}
                                                                className={
                                                                    'bg-transparant block px-4 py-2 text-h7 font-bold hover:bg-background hover:text-black dark:hover:bg-background dark:hover:text-black'
                                                                }
                                                                onClick={(event: any) => {
                                                                    if (event?.detail != 0) {
                                                                        if (window?.location.pathname == '/send')
                                                                            window?.location.reload()
                                                                    }
                                                                }}
                                                            >
                                                                {app.name}
                                                            </Link>
                                                        ))}
                                                    </Popover.Panel>
                                                </Transition>
                                            </div>
                                        )}
                                    </Popover>

                                    <Disclosure.Button
                                        key={'docs'}
                                        as="a"
                                        href={'/docs'}
                                        className="flex h-full items-center px-1 text-base text-h6 hover:bg-black hover:text-white dark:hover:bg-background dark:hover:text-black md:px-8"
                                    >
                                        DOCS
                                    </Disclosure.Button>
                                </div>
                            </div>
                        </div>
                        <div className="absolute inset-y-0 right-0 flex hidden items-center gap-2 pr-2 sm:flex">
                            <Link href={'/dashboard'} className="no-underline">
                                <button className="btn-purple btn-large">Dashboard</button>
                            </Link>
                            <button
                                className="wc-disable-mf btn-purple btn-large"
                                onClick={() => {
                                    web3modalOpen()
                                }}
                            >
                                {isConnected ? utils.shortenAddress(address ?? '') : 'Connect'}
                            </button>
                        </div>
                    </div>

                    <Disclosure.Panel className="sm:hidden">
                        <div className="space-y-3 px-4 pb-4 text-h7 font-bold ">
                            <Disclosure>
                                {({ open }) => (
                                    <>
                                        <Disclosure.Button
                                            className="bg-transparant flex h-full w-full cursor-pointer items-center border-none"
                                            key="app"
                                        >
                                            App
                                        </Disclosure.Button>
                                        <Disclosure.Panel className="space-y-3 px-4">
                                            {apps.map((app) => (
                                                <a
                                                    key={app.name}
                                                    href={app.href}
                                                    className="flex h-full cursor-pointer items-center "
                                                >
                                                    {app.name}
                                                </a>
                                            ))}
                                        </Disclosure.Panel>
                                    </>
                                )}
                            </Disclosure>
                            <Disclosure.Button
                                key="docs"
                                as="a"
                                href={'/docs'}
                                className="flex h-full cursor-pointer items-center"
                            >
                                Docs
                            </Disclosure.Button>

                            <Disclosure.Button
                                key="dashboard"
                                as="a"
                                href={'/dashboard'}
                                className="flex h-full cursor-pointer items-center"
                            >
                                Dashboard
                            </Disclosure.Button>
                            <Disclosure.Button
                                key="connect"
                                onClick={() => {
                                    web3modalOpen()
                                }}
                                className="flex h-full cursor-pointer items-center"
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

export default Header
