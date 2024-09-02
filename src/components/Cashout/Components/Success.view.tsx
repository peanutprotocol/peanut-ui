'use client'
import Icon from '@/components/Global/Icon'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as _consts from '../Cashout.consts'
import { useSubscription } from '@web3inbox/react'
import { useAccount } from 'wagmi'
import MoreInfo from '@/components/Global/MoreInfo'
import { useAuth } from '@/context/authContext'
import * as utils from '@/utils'

export const CashoutSuccessView = ({
    offrampForm,
    usdValue,

    transactionHash,
}: _consts.ICashoutScreenProps) => {
    const { user } = useAuth()

    const accountType = user?.accounts?.find(
        (account) => account?.account_identifier?.toLowerCase() === offrampForm.recipient?.toLowerCase()
    )?.account_type

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Yay!</label>
            <label className="text-h8 font-bold ">
                Your funds are on the way. A confirmation email will be sent to {offrampForm.email} shortly. Please keep
                in mind that it may take up to 2 days for the funds to arrive.
            </label>
            <div className="flex w-full flex-col items-center justify-center gap-2">
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'profile'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Name</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {offrampForm.name}
                    </span>
                </div>
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'email'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Email</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {offrampForm.email}
                    </span>
                </div>

                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'bank'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Bank account</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {offrampForm.recipient}
                    </span>
                </div>

                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'forward'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Route</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        Offramp <Icon name={'arrow-next'} className="h-4 fill-gray-1" /> {accountType}{' '}
                        <MoreInfo text={`Wait, crypto can be converted to real money??? How cool!`} />
                    </span>
                </div>
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Fee</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {user?.accounts.find((account) => account.account_identifier === offrampForm.recipient)
                            ?.account_type === 'iban'
                            ? '$1'
                            : '$0.50'}
                        <MoreInfo
                            text={
                                user?.accounts.find((account) => account.account_identifier === offrampForm.recipient)
                                    ?.account_type === 'iban'
                                    ? 'For SEPA transactions a fee of $1 is charged. For ACH transactions a fee of $0.50 is charged.'
                                    : 'For ACH transactions a fee of $0.50 is charged. For SEPA transactions a fee of $1 is charged.'
                            }
                        />
                    </span>
                </div>
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'transfer'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Total</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        $
                        {user?.accounts.find((account) => account.account_identifier === offrampForm.recipient)
                            ?.account_type === 'iban'
                            ? utils.formatTokenAmount(parseFloat(usdValue ?? '') - 1)
                            : utils.formatTokenAmount(parseFloat(usdValue ?? '') - 0.5)}
                        <MoreInfo
                            text={
                                user?.accounts.find((account) => account.account_identifier === offrampForm.recipient)
                                    ?.account_type === 'iban'
                                    ? 'For SEPA transactions a fee of $1 is charged. For ACH transactions a fee of $0.50 is charged. This will be deducted of the amount you will receive.'
                                    : 'For ACH transactions a fee of $0.50 is charged. For SEPA transactions a fee of $1 is charged. This will be deducted of the amount you will receive.'
                            }
                        />
                    </span>
                </div>
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
    )
}
