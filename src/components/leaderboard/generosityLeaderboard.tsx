'use client'
import peanut, { interfaces } from '@squirrel-labs/peanut-sdk'
import { useEffect, useState } from 'react'

import * as utils from '@/utils'
import chevron from '@/assets/dropdown.svg'

export function GenerosityLeaderboard() {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [popularityLeaderboard, setGenerosityLeaderboard] = useState<interfaces.IGenerosityLeaderboardEntry[]>([])
    const [arrayToUse, setArrayToUse] = useState<interfaces.IGenerosityLeaderboardEntry[]>([])

    const getGenerosityLeaderboard = async () => {
        const info = await peanut.getGenerosityLeaderboard({})
        setGenerosityLeaderboard(info)
    }

    useEffect(() => {
        getGenerosityLeaderboard()
    }, [])

    useEffect(() => {
        if (isCollapsed) {
            setArrayToUse(popularityLeaderboard.slice(0, 3))
        } else {
            setArrayToUse(popularityLeaderboard)
        }
    }, [isCollapsed, popularityLeaderboard])

    return (
        <div className={'flex w-72 flex-col items-center justify-center gap-0'}>
            <div className="max-h-[372px] w-full overflow-y-auto">
                <table className="w-full border-collapse">
                    <tbody className="w-full">
                        {arrayToUse.map((item, index) => (
                            <tr className="brutalborder w-full border p-2" key={index}>
                                <td className="w-1/4 w-[36px] p-2">#{index + 1}</td>
                                <td className="w-1/2 max-w-[125px] truncate p-2 font-normal">
                                    {item.name ?? utils.shortenAddress(item.address)}
                                </td>
                                <td className="w-1/4 p-2">{item.linksCreated}</td>
                            </tr>
                        ))}
                    </tbody>
                    {popularityLeaderboard.length > 3 && (
                        <tfoot
                            style={{
                                borderTop: '2px solid black',
                            }}
                        >
                            <tr className="sticky bottom-0 border-t bg-white">
                                <td colSpan={3} className="brutalborder w-full cursor-pointer border text-center">
                                    <img
                                        src={chevron.src}
                                        style={{
                                            transform: !isCollapsed ? 'scaleY(-1)' : 'none',
                                            transition: 'transform 0.3s ease-in-out',
                                        }}
                                        alt=""
                                        className="mx-auto h-6"
                                        onClick={() => setIsCollapsed(!isCollapsed)}
                                    />
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    )
}
