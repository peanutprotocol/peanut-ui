'use client'
import { useEffect, useState } from 'react'
import * as assets from '@/assets'
export const CashoutStatus = () => {
    const [cashoutStatus, setCashoutStatus] = useState<'FOUND' | 'NOT FOUND' | undefined>(undefined)
    const [cashoutStatusData, setCashoutStatusData] = useState<any>(undefined)

    useEffect(() => {
        try {
            const urlParams = new URLSearchParams(window.location.search)
            console.log('urlParams', urlParams)
            const createdLink = `${window.location.origin}/claim?${urlParams.toString()}`
            console.log('createdLink', createdLink)

            const x = {
                id: '657d3aba-6935-4481-a5f4-5ceebe121716',
                customer_id: 'ad4f340b-1917-4bce-b8b5-fa4dab86436c',
                liquidation_address_id: '0af37924-2ec7-492d-a754-4976909d8c5b',
                amount: '2.0',
                currency: 'usdc',
                state: 'payment_processed',
                created_at: '2024-09-03T12:27:06.787Z',
                destination: {
                    payment_rail: 'sepa',
                    currency: 'eur',
                    external_account_id: '7907fc40-0171-4015-8e38-154975bba682',
                },
                deposit_tx_hash: '0x343ac75dd59529385b5694d7c667a0bbebfffd7f7c90cf6b9a7ecd99a3bf3b70',
                deposit_tx_timestamp: '2024-09-03T12:25:27.888Z',
                from_address: '0xc28551de08997e4c013f50f6e566a0f31fc46a61',
                receipt: {
                    initial_amount: '2.0',
                    developer_fee: '0.0',
                    subtotal_amount: '2.0',
                    exchange_rate: '0.900000',
                    converted_amount: '1.8',
                    destination_currency: 'eur',
                    outgoing_amount: '1.8',
                    url: 'https://dashboard.bridge.xyz/transaction/4f881074-6f0c-4642-94c4-8f7866175b0a/receipt/7015a388-ffe1-4af0-95dc-eca52e63fa6f',
                },
            }

            setCashoutStatus('FOUND')
            setCashoutStatusData(x)
        } catch (error) {
            setCashoutStatus('NOT FOUND')
        }
    }, [])

    return (
        <div className="card">
            {!cashoutStatus ? (
                <div className="relative flex w-full items-center justify-center">
                    <div className="animate-spin">
                        <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                        <span className="sr-only">Loading...</span>
                    </div>
                </div>
            ) : cashoutStatus === 'FOUND' ? (
                <div className="mx-auto flex max-w-[96%] flex-col items-center justify-center gap-4 text-center">
                    <label className="text-h2">Cashout status</label>
                </div>
            ) : (
                cashoutStatus === 'NOT FOUND' && 'Cashout Not Found'
            )}
        </div>
    )
}
