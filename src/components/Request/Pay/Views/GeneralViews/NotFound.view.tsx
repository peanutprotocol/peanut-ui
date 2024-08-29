'use client'
import Icon from '@/components/Global/Icon'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

export const NotFoundClaimLink = () => {
    const router = useRouter()

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <label className="text-h2">Sorryyy</label>
            <label className="text-h8 font-bold ">
                This request could not be found. Are you sure your link is correct?
            </label>
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

            <Link
                className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                href={'/request/create'}
            >
                <div className=" border border-n-1 p-0 px-1">
                    <Icon name="send" className="-mt-0.5" />
                </div>
                Make a request yourself!
            </Link>
        </div>
    )
}

export default NotFoundClaimLink
