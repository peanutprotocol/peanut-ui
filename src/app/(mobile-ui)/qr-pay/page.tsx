'use client'

import { parseAsString, useQueryStates } from 'nuqs'
import { QrPayPage } from '@/features/payments/flows/qr-pay/QrPayPage'

export default function QRPayPage() {
    const [{ qrCode: rawQrCode, t: timestamp, type: qrType }] = useQueryStates({
        qrCode: parseAsString.withDefault(''),
        t: parseAsString,
        type: parseAsString,
    })
    // The scanner double-encodes the code into the URL, so one decode remains
    // after the query layer's own.
    const qrCode = decodeURIComponent(rawQrCode)

    // Keyed on the scan: a new QR remounts the whole flow with clean state —
    // this replaces the old page's resetState()-in-an-effect.
    return <QrPayPage key={`${qrCode}|${timestamp ?? ''}`} qrCode={qrCode} timestamp={timestamp} qrType={qrType} />
}
