'use client'
import '@/styles/globals.css'
import { useEffect } from 'react'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { Web3Modal } from '@web3modal/react'
import { WagmiConfig } from 'wagmi'
import peanutman_sad from '@/assets/peanutman-sad.svg'

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
            <WagmiConfig config={config.wagmiConfig}>
                <global_components.PageWrapper bgColor="bg-red">
                    <div className="flex flex-col gap-2 px-16 sm:flex-row md:px-32">
                        <div className="relative flex h-full flex-col items-start justify-center gap-2 font-light italic md:gap-0">
                            <h4 className="m-0 text-sm leading-none sm:text-base md:text-lg lg:text-xl">
                                Hey there! This is how we treat ur data.
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
                        <div className="h-full">
                            <img
                                src={peanutman_sad.src}
                                // className="w-1/3 scale-100 absolute z-index-100 -bottom-24 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
                                className="z-index-100 mt-16 w-2/3 scale-100 sm:w-full "
                                id="peanutman-presenting"
                            />
                        </div>
                    </div>
                </global_components.PageWrapper>
            </WagmiConfig>
            <Web3Modal
                projectId={process.env.WC_PROJECT_ID ?? ''}
                ethereumClient={config.ethereumClient}
                themeMode="dark"
                themeVariables={{
                    '--w3m-accent-color': '#F1F333', // accent color of the wc modal (text and logo ie) change to whatever you think looks good
                    '--w3m-background-color': '#F1F333', //top color of the wc modal, change to whatever you think looks good
                }}
            />
        </div>
    )
}
