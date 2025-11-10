'use client'

import { ICashoutScreenProps } from '../Cashout.consts'

export const InitialCashoutView = (_props: ICashoutScreenProps) => {
    return (
        <div className="mx-auto flex max-w-[96%] flex-col items-center justify-center gap-4 text-center">
            <label className="text-h2">Cash Out</label>
            <div className="flex flex-col justify-center gap-3">
                <label className="text-start text-h8 font-light">
                    Please go to{' '}
                    <a href="https://peanut.me" target="_blank" rel="noreferrer">
                        👉👉👉👉👉👉peanut.me👈👈👈👈👈👈
                    </a>{' '}
                    to cash out your crypto to your bank account.
                </label>
            </div>
        </div>
    )
}
