'use client'
import peanut, { interfaces } from '@squirrel-labs/peanut-sdk'
import { useEffect, useState } from 'react'

import * as global_components from '@/components/global'
import * as utils from '@/utils'
import peanutman_logo from '@/assets/peanutman-logo.svg'

const mock = [
    { name: 'XIBdiWhwyf', address: 'rCbrFRUAtVGgLFaJEwUNDcvgLMDZzYKtfRRHFHRxOw', popularity: 910 },
    { name: null, address: null, popularity: 604 },
    { name: null, address: null, popularity: 507 },
    { name: 'oJcTOlbJyj', address: null, popularity: 766 },
    { name: null, address: null, popularity: 297 },
    { name: 'tOREgNGjEN', address: 'JWyuWAmtaOlRCSgEVtpxXMjXCuXwKjJvOQfrDmMTxW', popularity: 717 },
    { name: null, address: 'VaTRFgOlonMAOWdmvqfOYZTPcVDPzYHcoRRhaihNeT', popularity: 589 },
    { name: null, address: null, popularity: 405 },
    { name: null, address: 'hswaziUPDVtFKvSIxSHczDxcJnimOrAQSqrkcBIWCO', popularity: 627 },
    { name: 'JlWFKEtMFC', address: 'mheFQIALnrdyBrBJUEETbYeVhAnrVNwRAIDuAvpeWf', popularity: 596 },
    { name: 'JMCTfupLob', address: 'BsaROtyilVTbtIAlZvWmlfQeGESjAKcRtrqeAhZEHN', popularity: 948 },
    { name: 'ZUJeIydbab', address: null, popularity: 899 },
    { name: null, address: 'ZAxNtGOAjLtiHfmoJsZPuwjuHiLkwenmnXrpdvpcMq', popularity: 500 },
    { name: 'ElBXxhmrcl', address: 'uKfYLqHBYoYTxAwrQvthcsmyjqHsqcDtcmdQaJvIDU', popularity: 4 },
    { name: null, address: null, popularity: 160 },
    { name: null, address: null, popularity: 957 },
    { name: 'JyBMVfnRNg', address: null, popularity: 587 },
    { name: null, address: null, popularity: 450 },
    { name: null, address: null, popularity: 612 },
    { name: 'RBHsTJZwSM', address: 'VJXbKsvjvavTyfsPEMDKjPvMAFXLZXoRToRJnjBuPC', popularity: 796 },
    { name: null, address: null, popularity: 491 },
    { name: 'kkwJLXKUuA', address: null, popularity: 222 },
    { name: null, address: 'grCWzKRNLTAUIaOKjILvMDNWMwXcSBpRcEvUdVZtic', popularity: 655 },
    { name: null, address: 'BZgBYBJqTQSchQhNBYeZyrPkOHQPVYhjWLoEBThAMb', popularity: 803 },
    { name: 'LlWmkrvgRP', address: null, popularity: 315 },
]

export function Leaderboard() {
    const [selectedTab, setSelectedTab] = useState<'Popularity' | 'Generosity'>('Popularity')
    const [popularityLeaderboard, setPopularityLeaderboard] = useState<interfaces.IPopularityLeaderboardEntry[]>([])
    const [generosityLeaderboard, setGenerosityLeaderboard] = useState<interfaces.IGenerosityLeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState<number>(0)

    const getPopularityLeaderboard = async () => {
        const info = await peanut.getPopularityLeaderboard({})
        setPopularityLeaderboard(info)
        setIsLoading((prev) => prev + 1)
    }

    const getGenerosityLeaderboard = async () => {
        const info = await peanut.getGenerosityLeaderboard({})
        setGenerosityLeaderboard(info)
        setIsLoading((prev) => prev + 1)
    }

    useEffect(() => {
        getPopularityLeaderboard()
        getGenerosityLeaderboard()
    }, [])

    function classNames(...classes: any) {
        return classes.filter(Boolean).join(' ')
    }

    const tabs = [{ name: 'Popularity' }, { name: 'Generosity' }]
    return (
        <div className="w-full">
            <div className="mb-4 hidden sm:block">
                <nav className="isolate flex divide-x divide-gray-200 rounded-none shadow" aria-label="Tabs">
                    {tabs.map((tab) => (
                        <div
                            key={tab.name}
                            className={classNames(
                                selectedTab == tab.name ? 'bg-teal hover:bg-teal' : 'bg-white hover:bg-white',
                                'group relative min-w-0 flex-1 cursor-pointer overflow-hidden px-4 py-4 text-center text-sm font-medium text-black focus:z-10'
                            )}
                            aria-current={selectedTab == tab.name ? 'page' : undefined}
                            onClick={() => setSelectedTab(tab.name as 'Popularity' | 'Generosity')}
                        >
                            <span>{tab.name}</span>
                            <span
                                aria-hidden="true"
                                className={classNames(
                                    selectedTab == tab.name ? 'bg-indigo-500' : 'bg-transparent',
                                    'absolute inset-x-0 bottom-0 h-0.5'
                                )}
                            />
                        </div>
                    ))}
                </nav>
            </div>
            {isLoading < 2 ? (
                <div
                    className={
                        'center-xy relative mx-auto mr-4 flex w-10/12 flex-col items-center bg-white px-4 py-6 text-black sm:mr-auto lg:w-2/3 xl:w-1/2 '
                    }
                >
                    <div className="animate-spin pb-16 pt-16">
                        <img src={peanutman_logo.src} alt="logo" className="h-8 sm:h-16" />
                        <span className="sr-only">Loading...</span>
                    </div>
                </div>
            ) : selectedTab == 'Popularity' ? (
                <div className={'flex  flex-col items-center justify-center gap-0'}>
                    <div className="brutalscroll max-h-[377px] w-full overflow-y-auto">
                        <table className="w-full border-collapse">
                            <tbody className="w-full">
                                {popularityLeaderboard.map((item, index) => (
                                    <tr className="brutalborder w-full border p-2" key={index}>
                                        <td className="w-[36px] p-2">#{index + 1}</td>
                                        <td className="p-2 font-normal">
                                            {item.name ?? utils.shortenAddress(item.address ?? '')}
                                        </td>
                                        <td className="p-2">
                                            {
                                                //@ts-ignore
                                                item.popularity
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                selectedTab == 'Generosity' && (
                    <div className={'flex flex-col items-center justify-center gap-0'}>
                        <div className="brutalscroll max-h-[377px] w-full overflow-y-auto">
                            <table className="w-full border-collapse">
                                <tbody className="w-full">
                                    {generosityLeaderboard.map((item, index) => (
                                        <tr className="brutalborder w-full border p-2" key={index}>
                                            <td className="w-[36px] p-2">#{index + 1}</td>
                                            <td className="p-2 font-normal">
                                                {item.name ?? utils.shortenAddress(item.address)}
                                            </td>
                                            <td className="p-2">{item.linksCreated}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}
        </div>
    )
}
