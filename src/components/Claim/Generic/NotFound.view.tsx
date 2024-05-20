'use client'
import Icon from '@/components/Global/Icon'

import * as _consts from '../Claim.consts'
import { useRouter } from 'next/navigation'

export const NotFoundClaimLink = () => {
    const router = useRouter()

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Sorryyy</label>
            <label className="text-h8 font-bold ">Deposit not found. Are you sure your link is correct?</label>
            <label className="text-h9 font-normal">
                We would like to hear from your experience. Hit us up on{' '}
                <a
                    className="cursor-pointer text-black underline dark:text-white"
                    target="_blank"
                    href="https://discord.gg/BX9Ak7AW28"
                >
                    Discord!
                </a>
            </label>
            <div className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black">
                <div
                    className="cursor-pointer border border-n-1 p-0 px-1"
                    onClick={() => {
                        router.push('/send')
                    }}
                >
                    <Icon name="send" className="-mt-0.5" />
                </div>
                <label className=" text-sm font-bold">Make a payment yourself!</label>
            </div>
        </div>
    )
}

export default NotFoundClaimLink
