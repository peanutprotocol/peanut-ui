'use client'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useState } from 'react'
import { isAddress } from 'viem'

import { Button } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import QRScanner from '@/components/Global/QRScanner'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { resolveFromEnsName, validateEnsName } from '@/utils'

const DirectSendQr = memo(() => {
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)
    const router = useRouter()
    const dispatch = useAppDispatch()

    const handleScan = useCallback(
        async (data: string) => {
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
        },
        [dispatch, router]
    )

    const handleOpenScanner = useCallback(() => {
        setIsQRScannerOpen(true)
    }, [])

    const handleCloseScanner = useCallback(() => {
        setIsQRScannerOpen(false)
    }, [])

    return (
        <>
            <Button
                onClick={handleOpenScanner}
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
            {isQRScannerOpen && <QRScanner onScan={handleScan} onClose={handleCloseScanner} isOpen={true} />}
        </>
    )
})

DirectSendQr.displayName = 'DirectSendQr'

export default DirectSendQr
