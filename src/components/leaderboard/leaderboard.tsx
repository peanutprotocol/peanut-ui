'use client'
import peanut, { interfaces } from '@squirrel-labs/peanut-sdk'
import { useEffect, useState } from 'react'

import * as global_components from '@/components/global'
import * as utils from '@/utils'

export function Leaderboard() {
    const [selectedTab, setSelectedTab] = useState<'Popularity' | 'Generosity'>('Popularity')
    const [popularityLeaderboard, setPopularityLeaderboard] = useState<interfaces.IGenerosityLeaderboardEntry[]>([])
    const [generosityLeaderboard, setGenerosityLeaderboard] = useState<interfaces.IGenerosityLeaderboardEntry[]>([])

    const getPopularityLeaderboard = async () => {
        const info = await peanut.getPopularityLeaderboard({})
        setPopularityLeaderboard(info)
    }

    const getGenerosityLeaderboard = async () => {
        const info = await peanut.getGenerosityLeaderboard({})
        const doubledInfo = info.flatMap((item) => [item, item])

        setGenerosityLeaderboard(doubledInfo)
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
        <global_components.CardWrapper>
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
                {selectedTab == 'Popularity' && (
                    <div className={'flex  flex-col items-center justify-center gap-0'}>
                        <div className="brutalscroll max-h-[377px] w-full overflow-y-auto">
                            <table className="w-full border-collapse">
                                <tbody className="w-full">
                                    {popularityLeaderboard.map((item, index) => (
                                        <tr className="brutalborder w-full border p-2" key={index}>
                                            <td className="w-[36px] p-2">#{index + 1}</td>
                                            <td className="p-2 font-normal">
                                                {item.name ?? utils.shortenAddress(item.address)}
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
                )}
                {selectedTab == 'Generosity' && (
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
                )}
            </div>
        </global_components.CardWrapper>
    )
}
