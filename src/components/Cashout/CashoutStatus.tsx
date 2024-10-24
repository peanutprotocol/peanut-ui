'use client'
import { useEffect, useState } from 'react'
import * as assets from '@/assets'
import { generateKeysFromString } from '@squirrel-labs/peanut-sdk'
import * as utils from '@/utils'
import Link from 'next/link'
import Icon from '../Global/Icon'
import { Card } from '../0_Bruddle'

export const CashoutStatus = () => {
    const [cashoutStatus, setCashoutStatus] = useState<'FOUND' | 'NOT FOUND' | undefined>(undefined)
    const [cashoutStatusData, setCashoutStatusData] = useState<utils.CashoutTransaction | undefined>(undefined)

    const getAndSetCashoutStatus = async () => {
        try {
            const response = await utils.getCashoutStatus(window.location.href)
            setCashoutStatusData(response)
            setCashoutStatus('FOUND')
        } catch (error) {
            console.error(error)
            setCashoutStatus('NOT FOUND')
        }
    }

    useEffect(() => {
        getAndSetCashoutStatus()
    }, [])

    if (!cashoutStatus) {
        return (
            <Card shadowSize="6">
                <Card.Content>
                    <div className="relative flex w-full items-center justify-center">
                        <div className="animate-spin">
                            <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                            <span className="sr-only">Loading...</span>
                        </div>
                    </div>
                </Card.Content>
            </Card>
        )
    }

    return (
        <Card shadowSize="6">
            <Card.Header>
                <Card.Title></Card.Title>
            </Card.Header>
            {cashoutStatus === 'FOUND' ? (
                <div className="mx-auto flex max-w-[96%] flex-col items-center justify-center gap-4 pb-20 text-center">
                    <label className="text-h2">Cashout status</label>
                    <div className="flex flex-col justify-center gap-3">
                        <label className="text-start text-h8 font-light">
                            {cashoutStatusData && utils.CashoutStatusDescriptions[cashoutStatusData?.status]}{' '}
                        </label>
                    </div>
                    <Link
                        className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                        href={`/profile`}
                    >
                        <div className=" border border-n-1 p-0 px-1">
                            <Icon name="dashboard" className="-mt-0.5" />
                        </div>
                        Go to profile
                    </Link>
                </div>
            ) : (
                cashoutStatus === 'NOT FOUND' && 'Cashout Not Found'
            )}
        </Card>
    )
}
