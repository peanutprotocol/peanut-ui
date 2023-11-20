'use client'
import Link from 'next/link'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useAccount } from 'wagmi'

import * as global_components from '@/components/global'
import * as utils from '@/utils'
import * as hooks from '@/hooks'

import peanut_logo from '@/assets/peanutman-logo.svg'
import smiley from '@/assets/smiley.svg'

export function Header({ showMarquee = true }: { showMarquee?: boolean }) {
    const { address, isConnected } = useAccount()
    const gaEventTracker = hooks.useAnalyticsEventTracker('header')

    const { open } = useWeb3Modal()

    return (
        <div>
            <nav className="relative my-2 flex max-h-20 flex-wrap justify-between bg-black">
                <div className="flex flex-grow items-center">
                    <div
                        className="flex h-full cursor-pointer items-center p-1 py-2 pl-1 text-2xl font-bold uppercase text-white no-underline hover:bg-white hover:text-black"
                        onClick={() => {
                            if (window.location.pathname == '/') window.location.reload()
                            else window.location.href = '/'
                        }}
                    >
                        <img src={peanut_logo.src} alt="logo" className="h-6 sm:h-10" />
                        <span className="hidden lg:inline lg:px-6">peanut protocol</span>
                    </div>

                    <Link
                        className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold uppercase text-white no-underline hover:bg-white hover:text-black lg:px-8"
                        href={'/send'}
                    >
                        <span className="">send</span>
                    </Link>
                    <Link
                        className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold uppercase text-white no-underline hover:bg-white hover:text-black lg:px-8"
                        href={'https://docs.peanut.to'}
                    >
                        <span className="">docs</span>
                    </Link>
                </div>
                <div className="mr-1 flex h-full gap-1 self-center sm:gap-4">
                    <Link href={'/dashboard'} className="no-underline">
                        <button className="brutalborder block h-full cursor-pointer bg-white p-1 text-center text-sm font-bold text-black hover:invert sm:px-4 sm:py-2 md:h-max lg:text-lg">
                            Dashboard
                        </button>
                    </Link>
                    <button
                        id="connectButton"
                        className="brutalborder block h-full cursor-pointer bg-white p-1 text-center text-sm font-bold text-black hover:invert sm:px-4 sm:py-2 md:mr-4 lg:text-lg"
                        onClick={() => {
                            open()
                        }}
                    >
                        {isConnected ? utils.shortenAddress(address ?? '') : 'Connect'}
                    </button>
                </div>
            </nav>
            {showMarquee && (
                <global_components.MarqueeWrapper
                    backgroundColor="bg-red"
                    onClick={() => {
                        window.open('https://peanutprotocol.gitbook.io/peanut-protocol-docs-1/overview/what-we-do')
                    }}
                    direction="right"
                >
                    {/* <>
                        <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
                            EXPERIMENTAL
                        </div>
                        <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                        <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
                            x-chain
                        </div>
                        <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    </> */}
                </global_components.MarqueeWrapper>
            )}
        </div>
    )
}
