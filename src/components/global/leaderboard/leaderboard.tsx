'use client'

import { useEffect, useState } from 'react'

import * as utils from '@/utils'
import chevron from '@/assets/dropdown.svg'

const claimsArray = [
    {
        amount: 10,
        name: 'John Doe',
    },
    {
        amount: 5,
        name: 'Jane Doe',
    },
    {
        amount: 2,
        name: 'John Doe',
    },
    {
        amount: 1,
        name: 'Jane Doe',
    },
    {
        amount: 3,
        name: 'John Doe',
    },
    {
        amount: 4,
        name: 'Jane Doe',
    },
    {
        amount: 6,
        name: 'John Doe',
    },
    {
        amount: 7,
        name: 'Jane Doe',
    },
    {
        amount: 8,
        name: 'John Doe',
    },
    {
        amount: 9,
        name: 'Jane Doe',
    },
]

export function leaderBoardComp() {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [arrayToUse, setArrayToUse] = useState<{ name: string; amount: number }[]>([])

    useEffect(() => {
        isCollapsed
            ? setArrayToUse(claimsArray.sort((a, b) => b.amount - a.amount).slice(0, 3))
            : setArrayToUse(claimsArray.sort((a, b) => b.amount - a.amount))
    }, [isCollapsed])
    return (
        <div className={'flex w-64 flex-col items-center justify-center gap-0'}>
            {arrayToUse.map((claim, index) => {
                return (
                    <div
                        className={
                            'brutalborder-top brutalborder-left brutalborder-right flex w-full flex-row items-start justify-center gap-2 p-2 '
                        }
                        key={index}
                    >
                        <div className="flex w-[36px] items-start">#{index + 1}</div>
                        <div className="flex w-full flex-row items-center justify-between ">
                            <div className="font-normal ">{claim.name}</div>
                            <div>{utils.formatTokenAmount(claim.amount)}</div>
                        </div>
                    </div>
                )
            })}
            <div
                className={'brutalborder flex w-full flex-row items-start justify-center gap-2 px-2'}
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
        </div>
    )
}
