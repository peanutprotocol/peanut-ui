'use client'

import { PaymentsFooter } from '@/components/Global/PaymentsFooter'

export const WrongPasswordClaimLink = () => {
    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-start">
            <div className="space-y-2">
                <h2 className="text-h2">Sorryyy</h2>
                <div className="">This link is malformed. Are you sure you copied it correctly?</div>
            </div>

            <label className="text-h8 font-normal">
                We would like to hear from your experience. Hit us up on{' '}
                <a className="text-link-decoration" target="_blank" href="https://discord.gg/BX9Ak7AW28">
                    Discord!
                </a>
            </label>

            <PaymentsFooter />
        </div>
    )
}
