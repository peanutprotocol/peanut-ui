'use client'
import CopyField from '@/components/Global/CopyField'
import Icon from '@/components/Global/Icon'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useContext, useMemo, useState } from 'react'
import Link from 'next/link'
import * as _consts from '../Create.consts'
import * as consts from '@/constants'
import * as context from '@/context'

export const CreateLinkSuccessView = ({ link, txHash }: _consts.ICreateScreenProps) => {
    const { selectedChainID } = useContext(context.tokenSelectorContext)

    const explorerUrlWithTx = useMemo(
        () =>
            `${consts.supportedPeanutChains.find((detail) => detail.chainId === selectedChainID)?.explorers[0].url}/tx/${txHash}`,
        [txHash, selectedChainID]
    )
    const share = async (url: string) => {
        try {
            await navigator.share({
                title: 'Peanut Protocol',
                text: 'Peanut Protocol',
                url,
            })
        } catch (error: any) {
            console.log(error)
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Yay!</label>
            <QRCodeWrapper url={link} />
            <label className="text-h8 font-bold ">
                Scan the QR code above or send this link to your friends so they can claim their funds.
            </label>
            <div className="hidden w-full md:block">
                <CopyField text={link} />
            </div>
            <div
                className="w-full border border-n-1 px-2 py-1 text-h8 font-normal sm:hidden"
                onClick={() => {
                    share(link)
                }}
            >
                Share link
            </div>
            <Link
                className="cursor-pointer self-start text-h8 font-bold text-gray-1 underline"
                href={`${explorerUrlWithTx}`}
            >
                Transaction hash
            </Link>

            <div className="absolute bottom-0 -mb-0.5 flex h-20 w-[27rem] w-full flex-row items-center justify-between border border-black border-n-1 bg-purple-3  px-4.5 dark:text-black">
                <div className="cursor-pointer border border-n-1 p-0 px-1">
                    <Icon name="email" className="-mt-0.5" />
                </div>
                <label className="text-sm font-bold">Subscribe to get notified when you link gets claimed!</label>
            </div>
        </div>
    )
}
