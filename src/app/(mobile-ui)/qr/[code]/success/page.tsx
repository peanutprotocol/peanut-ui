'use client'

import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { BASE_URL } from '@/constants'
import { useAuth } from '@/context/authContext'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { Icon } from '@/components/Global/Icons/Icon'
import { confettiPresets } from '@/utils/confetti'
import QRCode from 'react-qr-code'
import { useRedirectQrStatus } from '@/hooks/useRedirectQrStatus'

export default function RedirectQrSuccessPage() {
    const router = useRouter()
    const params = useParams()
    const code = params?.code as string
    const { user } = useAuth()

    // Fetch redirect QR details using shared hook
    const { data: redirectQrData, isLoading } = useRedirectQrStatus(code)

    // Extract invite code from redirect URL
    const inviteCode = useMemo(() => {
        if (!redirectQrData?.redirectUrl) return ''
        try {
            const url = new URL(redirectQrData.redirectUrl)
            return url.searchParams.get('code') || ''
        } catch {
            return ''
        }
    }, [redirectQrData?.redirectUrl])

    // Trigger confetti on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            confettiPresets.success()
        }, 300)

        return () => clearTimeout(timer)
    }, [])

    if (isLoading || !redirectQrData) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Success" />
                <div className="flex h-full items-center justify-center">
                    <PeanutLoading />
                </div>
            </div>
        )
    }

    const qrUrl = `${BASE_URL}/qr/${code}`

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Success" />
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* Success Message */}
                <Card className="space-y-4 p-6">
                    <div className="flex items-center justify-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success-3">
                            <Icon name="check" size={40} className="text-black" />
                        </div>
                    </div>
                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl font-extrabold">QR Code Claimed!</h1>
                        <p className="text-base text-grey-1">
                            This QR code is now permanently linked to your profile. Share it with anyone to receive
                            payments instantly.
                        </p>
                    </div>
                </Card>

                {/* QR Code Display */}
                <Card className="space-y-4 p-6">
                    <div className="space-y-2">
                        <h2 className="text-center text-lg font-bold">Your Personal QR Code</h2>
                        <p className="text-center text-sm text-grey-1">
                            Anyone who scans this will be able to connect with you
                        </p>
                    </div>

                    {/* QR Code */}
                    <div className="flex items-center justify-center rounded-lg bg-white p-6">
                        <div className="rounded-lg border-4 border-black p-4">
                            <QRCode value={qrUrl} size={200} level="M" />
                        </div>
                    </div>

                    {/* QR URL */}
                    <div className="space-y-1">
                        <p className="text-center text-xs text-grey-1">Share this link:</p>
                        <div className="rounded-lg bg-grey-3 px-4 py-3">
                            <p className="break-all text-center font-mono text-sm">{qrUrl}</p>
                        </div>
                    </div>
                </Card>

                {/* Info Card */}
                <Card className="border-2 border-secondary-1 bg-secondary-1/10 p-4">
                    <div className="flex gap-3">
                        <Icon name="star" size={20} className="flex-shrink-0 text-secondary-1" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Your QR code is ready!</p>
                            <p className="text-xs text-grey-1">
                                Put this sticker on your laptop, water bottle, or anywhere you want people to find you.
                                They can scan it to send you money or connect with you on Peanut.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={() => router.push('/home')}
                        className="w-full"
                        icon="arrow-up-right"
                    >
                        Go to Home
                    </Button>
                    <Button
                        variant="primary-soft"
                        shadowSize="4"
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({
                                    title: 'My Peanut QR Code',
                                    text: 'Scan my QR code to connect with me on Peanut!',
                                    url: qrUrl,
                                })
                            } else {
                                // Fallback: copy to clipboard
                                navigator.clipboard.writeText(qrUrl)
                                alert('Link copied to clipboard!')
                            }
                        }}
                        className="w-full"
                        icon="share"
                    >
                        Share QR Code
                    </Button>
                </div>
            </div>
        </div>
    )
}
