'use client'
import '@/styles/globals.css'
import { useEffect } from 'react'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { WagmiConfig } from 'wagmi'

import * as config from '@/config'
import * as global_components from '@/components/global'
import * as hooks from '@/hooks'

const inter = Inter({ subsets: ['latin'] })

export default function NotFound() {
    const gaEventTracker = hooks.useAnalyticsEventTracker('404-page')

    useEffect(() => {
        gaEventTracker('peanut-opened', '404-not-found')
    }, [])
    return (
        <div className={inter.className}>
            <config.ContextProvider>
                <global_components.PageWrapper bgColor="bg-red">
                    <div className="flex flex-col gap-2 px-8 sm:flex-row md:px-32">
                        <div className="relative flex h-full flex-col items-start justify-center gap-2 font-light italic md:gap-0">
                            <h4 className="m-0 text-sm leading-none sm:text-base md:text-lg lg:text-xl">
                                Sowwy can't find anything
                            </h4>
                            <h1 className="m-0 truncate text-2xl font-bold leading-none md:text-4xl lg:text-6xl xl:text-8xl">
                                404: Not Found.
                            </h1>
                            <button
                                className="my-4 mb-4 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                                id="cta-btn"
                            >
                                Try Beta
                            </button>
                            <div className="text-sm lg:text-lg">
                                Hit us up on{' '}
                                <Link className="text-white" href={''}>
                                    Discord
                                </Link>
                                !
                            </div>
                        </div>

                        <iframe
                            className="brutalborder brutalshadow block w-full  border-0 lg:w-1/2"
                            src="/game/peanut-game.html"
                            title="Peanut Game"
                            allow="fullscreen"
                        ></iframe>
                    </div>
                </global_components.PageWrapper>
            </config.ContextProvider>
        </div>
    )
}
