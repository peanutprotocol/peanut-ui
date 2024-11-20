'use client'
import Icon from '@/components/Global/Icon'

import * as _consts from '../Claim.consts'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export const NotFoundClaimLink = () => {
    const router = useRouter()

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <div className="space-y-2">
                <h2 className="text-h2">Sorryyy</h2>
                <div className="">Deposit not found. Are you sure your link is correct?</div>
            </div>

            <label className="text-h8 font-normal">
                We would like to hear from your experience. Hit us up on{' '}
                <a className="text-link-decoration" target="_blank" href="https://discord.gg/BX9Ak7AW28">
                    Discord!
                </a>
            </label>

            <Link className="btn-purple btn-xl flex w-full flex-row items-center justify-center gap-1" href={'/send'}>
                <div className="">
                    <Icon name="send" className="" />
                </div>
                Make a payment yourself!
            </Link>
        </div>
    )
}
