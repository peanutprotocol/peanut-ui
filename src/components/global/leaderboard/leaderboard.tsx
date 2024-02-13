'use client'
import { useEffect, useState } from 'react'
import { interfaces } from '@squirrel-labs/peanut-sdk'

import * as utils from '@/utils'
import chevron from '@/assets/dropdown.svg'

export function leaderBoardComp({ leaderboardInfo }: { leaderboardInfo: interfaces.IRaffleLeaderboardEntry[] }) {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [arrayToUse, setArrayToUse] = useState<interfaces.IRaffleLeaderboardEntry[]>([])

    useEffect(() => {
        isCollapsed
            ? setArrayToUse(leaderboardInfo.sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 3))
            : setArrayToUse(leaderboardInfo.sort((a, b) => Number(b.amount) - Number(a.amount)))
    }, [isCollapsed, leaderboardInfo])

    console.log(arrayToUse)

    return (
        <div className={'flex w-72 flex-col items-center justify-center gap-0'}>
            <div className="max-h-[450px] w-full overflow-y-auto">
                <table className="w-full border-collapse">
                    <tbody className="w-full">
                        {arrayToUse.map((claim, index) => (
                            <tr className="brutalborder w-full border p-2" key={index}>
                                <td className="w-1/4 w-[36px] p-2">#{index + 1}</td>
                                <td className="w-1/2 max-w-[125px] truncate p-2 font-normal">
                                    {claim.name == '' || claim.name == null
                                        ? utils.shortenAddress(claim.address)
                                        : claim.name}
                                </td>
                                <td className="flex w-1/4 flex-row gap-1 p-2">
                                    <div>{utils.formatTokenAmount(Number(claim.amount), 4)}</div>
                                    <div>{claim.tokenSymbol}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {leaderboardInfo.length > 3 && (
                        <tfoot
                            style={{
                                borderTop: '2px solid black',
                            }}
                            onClick={() => setIsCollapsed(!isCollapsed)}
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
