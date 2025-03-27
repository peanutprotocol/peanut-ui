'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { isAddress } from 'viem'

import { Button } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import QRScanner from '@/components/Global/QRScanner'
import { resolveFromEnsName, validateEnsName } from '@/utils'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'

export default function DirectSendQr() {
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)
    const router = useRouter()
    const dispatch = useAppDispatch()

    const processQRCode = async (data: string) => {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!
        let redirectUrl: string | undefined = undefined
        if (data.startsWith(baseUrl)) {
            let path = data
            if (path.startsWith(baseUrl)) {
                path = path.substring(baseUrl.length)
            }
            if (!path.startsWith('/')) {
                path = '/' + path
            }
            redirectUrl = path
        } else if (isAddress(data)) {
            // hardcode PNT because this is only used for pinta wallet for now
            redirectUrl = `${baseUrl}/${data}@polygon/PNT`
        } else if (validateEnsName(data)) {
            const resolvedAddress = await resolveFromEnsName(data.toLowerCase())
            if (!!resolvedAddress) {
                redirectUrl = `${baseUrl}/${resolvedAddress}@polygon/PNT`
            }
        }

        if (redirectUrl) {
            dispatch(paymentActions.setView('INITIAL'))
            router.push(redirectUrl)
            return { success: true }
        }

        return {
            success: false,
            error: 'QR not recognized as Peanut URL',
        }
    }
    return (
        <>
            <Button
                onClick={() => setIsQRScannerOpen(true)}
                variant="purple"
                className={
                    'mx-auto flex w-full cursor-pointer items-center justify-center gap-2 rounded-full md:w-fit' +
                    ' [-webkit-tap-highlight-color:transparent]' +
                    ' [&]:!-webkit-appearance-none'
                }
                style={{
                    WebkitAppearance: 'none',
                }}
                shadowSize="4"
            >
                <Icon name="camera" fill="black" className="size-4" />
                <span>Scan QR Code</span>
            </Button>
            {isQRScannerOpen && (
                <QRScanner onScan={processQRCode} onClose={() => setIsQRScannerOpen(false)} isOpen={true} />
            )}
        </>
    )
}
