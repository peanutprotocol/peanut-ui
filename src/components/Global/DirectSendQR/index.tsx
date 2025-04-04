'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import QRScanner from '@/components/Global/QRScanner'
import { resolveFromEnsName } from '@/utils'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { recognizeQr, EQrType, parseEip681 } from './utils'
import { useToast } from '@/components/0_Bruddle/Toast'
import * as Sentry from '@sentry/nextjs'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!

export default function DirectSendQr() {
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)
    const router = useRouter()
    const dispatch = useAppDispatch()
    const toast = useToast()

    const processQRCode = async (data: string) => {
        let redirectUrl: string | undefined = undefined
        data = data.toLowerCase()
        switch (recognizeQr(data)) {
            case EQrType.PEANUT_URL:
                let path = data
                path = path.substring(BASE_URL.length)
                if (!path.startsWith('/')) {
                    path = '/' + path
                }
                redirectUrl = path
                break
            case EQrType.PINTA_MERCHANT:
                redirectUrl = `/${data}@polygon/PNT`
                break
            case EQrType.EVM_ADDRESS:
                //TODO: show that we can only send usd in arbitrum before redirecting
                redirectUrl = `/${data}@arbitrum/usdc`
                break
            case EQrType.EIP_681:
                //TODO: show that we can only send usd in arbitrum before redirecting
                try {
                    const { address } = parseEip681(data)
                    if (address) {
                        redirectUrl = `/${address}@arbitrum/usdc`
                    }
                } catch (error) {
                    toast.error('Error parsing EIP-681 URL')
                    Sentry.captureException(error)
                }
                break
            case EQrType.ENS_NAME:
                const resolvedAddress = await resolveFromEnsName(data.toLowerCase())
                if (!!resolvedAddress) {
                    //TODO: show that we can only send usd in arbitrum before redirecting
                    redirectUrl = `/${data}@arbitrum/usdc`
                }
                break
            case EQrType.MERCADO_PAGO:
                //TODO: show that we recognize it but not support it yet
                toast.info('Mercado Pago QR code recognized')
                return { success: true }
            // break
            case EQrType.BITCOIN_ONCHAIN:
                //TODO: show that we recognize it but not support it yet
                toast.info('Bitcoin On-Chain QR code recognized')
                return { success: true }
            // break
            case EQrType.BITCOIN_INVOICE:
                //TODO: show that we recognize it but not support it yet
                toast.info('Bitcoin Invoice QR code recognized')
                return { success: true }
            // break
            case EQrType.PIX:
                //TODO: show that we recognize it but not support it yet
                toast.info('PIX QR code recognized')
                return { success: true }
            // break
            case EQrType.TRON_ADDRESS:
                //TODO: show that we recognize it but not support it yet
                toast.info('Tron Address QR code recognized')
                return { success: true }
            // break
            case EQrType.SOLANA_ADDRESS:
                //TODO: show that we recognize it but not support it yet
                toast.info('Solana Address QR code recognized')
                return { success: true }
            // break
            case EQrType.XRP_ADDRESS:
                //TODO: show that we recognize it but not support it yet
                toast.info('XRP Address QR code recognized')
                return { success: true }
            // break
            case EQrType.URL:
                redirectUrl = data
                break
            default:
                break
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
