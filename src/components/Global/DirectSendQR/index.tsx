'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { isAddress } from 'viem'

import { Button } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import QRScanner from '@/components/Global/QRScanner'
import { resolveFromEnsName, validateEnsName } from '@/utils'

export default function DirectSendQr() {
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)
    const router = useRouter()

    const processQRCode = async (data: string) => {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!
        if (data.startsWith(baseUrl)) {
            let path = data
            if (path.startsWith(baseUrl)) {
                path = path.substring(baseUrl.length)
            }
            if (!path.startsWith('/')) {
                path = '/' + path
            }
            router.push(path)
            return { success: true }
        } else if (isAddress(data)) {
            // hardcode PNT because this is only used for pinta wallet for now
            const link = `${baseUrl}/${data}@polygon/PNT`
            router.push(link)
            return { success: true }
        } else if (validateEnsName(data)) {
            const resolvedAddress = await resolveFromEnsName(data.toLowerCase())
            if (!!resolvedAddress) {
                const link = `${baseUrl}/${resolvedAddress}@polygon/PNT`
                router.push(link)
                return { success: true }
            }
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
                    'mx-auto flex w-[90%] cursor-pointer items-center justify-center gap-2 rounded-full md:w-fit' +
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
