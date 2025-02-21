'use client'
import PEANUTMAN_CRY from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_05.gif'
import * as utils from '@/utils'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card } from '../0_Bruddle'
import Icon from '../Global/Icon'
import PeanutLoading from '../Global/PeanutLoading'
import * as Sentry from '@sentry/nextjs'

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
            Sentry.captureException(error)
        }
    }

    useEffect(() => {
        getAndSetCashoutStatus()
    }, [])

    if (!cashoutStatus) {
        return <PeanutLoading />
    }

    return (
        <Card className="shadow-primary-4 w-full pt-6 md:w-5/12">
            {cashoutStatus == 'FOUND' ? (
                <div className="flex flex-col items-stretch justify-center gap-4 text-start">
                    <div className="space-y-3 px-6">
                        <label className="text-h2">Cashout status</label>
                        <div className="flex flex-col justify-center gap-3">
                            <label className="text-start text-h8 font-light">
                                {cashoutStatusData && utils.CashoutStatusDescriptions[cashoutStatusData?.status]} gm
                            </label>
                        </div>
                    </div>
                    <Link
                        className="flex h-20 w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                        href={`/history`}
                    >
                        <div className=" border border-n-1 p-0 px-1">
                            <Icon name="dashboard" className="-mt-0.5" />
                        </div>
                        Go to history
                    </Link>
                </div>
            ) : (
                cashoutStatus === 'NOT FOUND' && (
                    <div>
                        <div className="flex flex-col items-center justify-center gap-3 px-6 pb-6">
                            <Image src={PEANUTMAN_CRY.src} alt="Peanutman crying 😭" width={96} height={96} />
                            <div>Cashout Not Found</div>
                        </div>
                        <Link
                            className="flex h-16 w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                            href={`/home`}
                        >
                            <div className=" border border-n-1 p-0 px-1">
                                <Icon name="dashboard" className="-mt-0.5" />
                            </div>
                            Go to Home
                        </Link>
                    </div>
                )
            )}
        </Card>
    )
}
