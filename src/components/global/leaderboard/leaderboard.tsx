'use client'

import { useEffect, useState } from 'react'

import * as utils from '@/utils'
import chevron from '@/assets/dropdown.svg'
import { interfaces } from '@squirrel-labs/peanut-sdk'

const xxx: interfaces.IRaffleLeaderboardEntry[] = [
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '88888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '88888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
    {
        address: '0x1234...5678',
        amount: '888',
        name: '0x1234...5678',
    },
]

export function leaderBoardComp({ leaderboardInfo }: { leaderboardInfo: interfaces.IRaffleLeaderboardEntry[] }) {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [arrayToUse, setArrayToUse] = useState<interfaces.IRaffleLeaderboardEntry[]>([])

    useEffect(() => {
        isCollapsed
            ? setArrayToUse(leaderboardInfo.sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 3))
            : setArrayToUse(leaderboardInfo.sort((a, b) => Number(b.amount) - Number(a.amount)))
    }, [isCollapsed])
    return (
        <div className={'flex w-64 flex-col items-center justify-center gap-0'}>
            {arrayToUse.map((claim, index) => {
                return (
                    <div
                        className={
                            'brutalborder-top brutalborder-left brutalborder-right flex w-full flex-row items-start justify-center gap-2 p-2 ' +
                            (leaderboardInfo.length <= 3 && arrayToUse.length - 1 === index
                                ? ' brutalborder-bottom '
                                : '')
                        }
                        key={index}
                    >
                        <div className="flex w-[36px] items-start">#{index + 1}</div>
                        <div className="flex w-full flex-row items-center justify-between ">
                            <div className="font-normal ">{claim.name ?? utils.shortenAddress(claim.address)}</div>
                            <div>{utils.formatTokenAmount(Number(claim.amount))}</div>
                        </div>
                    </div>
                )
            })}

            {leaderboardInfo.length > 3 && (
                <div
                    className={'brutalborder flex w-full cursor-pointer flex-row items-start justify-center gap-2 px-2'}
                    onClick={() => {
                        setIsCollapsed(!isCollapsed)
                    }}
                >
                    <img
                        src={chevron.src}
                        style={{
                            transform: !isCollapsed ? 'scaleY(-1)' : 'none',
                            transition: 'transform 0.3s ease-in-out',
                        }}
                        alt=""
                        className={'h-6'}
                    />
                </div>
            )}
        </div>
    )
}
