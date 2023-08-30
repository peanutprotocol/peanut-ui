'use client'
import Link from 'next/link'
import { useWeb3Modal } from '@web3modal/react'
import { useAccount } from 'wagmi'

import * as global_components from '@/components/global'
import * as utils from '@/utils'

import peanut_logo from '@/assets/peanutman-logo.svg'
import smiley from '@/assets/smiley.svg'
import { useRouter } from 'next/navigation'

export function Header({ showMarquee = true }: { showMarquee?: boolean }) {
    const { address, isConnected } = useAccount()

    const { open } = useWeb3Modal()

    return (
        <div>
            <nav className="relative my-2 flex max-h-20 flex-wrap justify-between bg-black">
                <div className="flex flex-grow items-center">
                    <div
                        className="ml-1 flex h-full cursor-pointer items-center p-1 py-2 text-2xl font-bold uppercase text-white no-underline hover:bg-white hover:text-black"
                        onClick={() => {
                            window.location.reload()
                        }}
                    >
                        <img src={peanut_logo.src} alt="logo" className="h-6 sm:h-10" />
                        <span className="hidden lg:inline lg:px-6">peanut protocol</span>
                    </div>

                    <div
                        className="flex h-full cursor-pointer items-center px-1 py-2 text-base font-bold uppercase text-white no-underline hover:bg-white hover:text-black lg:px-8"
                        onClick={() => {
                            window.open(
                                'https://peanutprotocol.notion.site/Peanut-Protocol-5776ec3a97de4e5d972ae3f6ba7f4f04'
                            )
                        }}
                    >
                        <span className="">docs</span>
                    </div>
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
                        onClick={open}
                    >
                        {isConnected ? utils.shortenAddress(address ?? '') : 'Connect'}
                    </button>
                </div>
            </nav>
            {showMarquee && (
                <global_components.MarqueeWrapper
                    backgroundColor="bg-fuchsia"
                    onClick={() => {
                        window.open(
                            'https://peanutprotocol.notion.site/Send-Tokens-via-Link-Peanut-Link-SDK-1-0-9a89ea726b754a1c9f7e012125a01a85'
                        )
                    }}
                >
                    <>
                        <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
                            new sdk
                        </div>
                        <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                        <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
                            click here
                        </div>
                        <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
                    </>
                </global_components.MarqueeWrapper>
            )}
        </div>
    )
}
