'use client'

import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { PEANUT_API_URL } from '@/constants'
import { useAuth } from '@/context/authContext'
import { useRouter, useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import { saveRedirectUrl } from '@/utils'
import { getShakeClass } from '@/utils/perk.utils'
import Cookies from 'js-cookie'
import { useRedirectQrStatus } from '@/hooks/useRedirectQrStatus'
import { useHoldToClaim } from '@/hooks/useHoldToClaim'

export default function RedirectQrClaimPage() {
    const router = useRouter()
    const params = useParams()
    const code = params?.code as string
    const { user } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Fetch redirect QR status using shared hook
    const { data: redirectQrData, isLoading: isCheckingStatus, error: redirectQrError } = useRedirectQrStatus(code)

    // Handle redirects based on QR status and authentication
    useEffect(() => {
        // Wait for QR status to load
        if (isCheckingStatus || !redirectQrData) {
            return
        }

        // If QR is already claimed, redirect to the target URL
        if (redirectQrData.claimed && redirectQrData.redirectUrl) {
            try {
                const url = new URL(redirectQrData.redirectUrl)

                // Check if external redirect (different domain)
                const isExternal = url.origin !== window.location.origin

                if (isExternal) {
                    // External redirect - use full URL navigation
                    window.location.href = redirectQrData.redirectUrl
                } else {
                    // Internal redirect - extract path for Next.js router (better UX, no page reload)
                    const invitePath = `${url.pathname}${url.search}` // e.g., /invite?code=XYZINVITESYOU
                    router.push(invitePath)
                }
            } catch (error) {
                // Fallback for invalid URLs
                window.location.href = redirectQrData.redirectUrl
            }
            return
        }

        // QR is not claimed - check authentication
        if (!user) {
            // User not logged in - redirect to setup to create account/login
            saveRedirectUrl()
            router.push('/setup')
        }
    }, [isCheckingStatus, redirectQrData, user, router])

    const handleClaim = useCallback(async () => {
        // Auth check is already handled by useEffect above
        // If we reach here, user is authenticated
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch(`${PEANUT_API_URL}/qr/${code}/claim`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                },
                body: JSON.stringify({}), // Empty body to prevent "Unexpected end of JSON input" error
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Failed to claim QR code')
            }

            // Success! Show success page, then redirect to invite (which goes to profile for logged-in users)
            router.push(`/qr/${code}/success`)
        } catch (err: any) {
            console.error('Error claiming QR:', err)
            setError(err.message || 'Failed to claim QR code. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }, [code, router])

    // Hold-to-claim mechanics with shake animation
    const { holdProgress, isShaking, shakeIntensity, buttonProps } = useHoldToClaim({
        onComplete: handleClaim,
        disabled: isLoading,
    })

    // Show loading while checking status or if we're in the process of redirecting
    if (isCheckingStatus || (redirectQrData?.claimed && redirectQrData?.redirectUrl)) {
        return (
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
                <NavHeader title="Claim QR Code" />
                <div className="flex h-full items-center justify-center">
                    <PeanutLoading />
                </div>
            </div>
        )
    }

    // If not logged in and QR is unclaimed, the useEffect above will redirect to setup
    // This loading screen will show briefly during that redirect
    if (!user) {
        return (
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
                <NavHeader title="Claim QR Code" />
                <div className="flex h-full items-center justify-center">
                    <PeanutLoading />
                </div>
            </div>
        )
    }

    // Show error only if there's an actual error or QR is not available (and not claimed)
    if (redirectQrError || !redirectQrData || (!redirectQrData.available && !redirectQrData.claimed)) {
        return (
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
                <NavHeader title="Claim QR Code" />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="space-y-4 p-6">
                        <div className="flex items-center justify-center">
                            <div className="bg-red-100 flex h-16 w-16 items-center justify-center rounded-full">
                                <Icon name="cancel" size={32} className="text-red-600" />
                            </div>
                        </div>
                        <div className="space-y-2 text-center">
                            <h1 className="text-2xl font-extrabold">QR Code Unavailable</h1>
                            <p className="text-base text-grey-1">
                                {redirectQrData?.claimed
                                    ? 'This QR code has already been claimed by another user.'
                                    : redirectQrError
                                      ? 'Failed to check QR code status. Please try again.'
                                      : 'This QR code is not available for claiming.'}
                            </p>
                        </div>
                    </Card>
                    <Button variant="purple" shadowSize="4" onClick={() => router.push('/home')} className="w-full">
                        Go to Home
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
            <NavHeader title="Claim Your QR Code" />
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* QR Code Visual */}
                <Card className="space-y-4 p-6">
                    <div className="flex items-center justify-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full">
                            <Icon name="qr-code" size={40} className="text-purple-600" />
                        </div>
                    </div>
                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl font-extrabold">Claim Your Code</h1>
                        <p className="text-base text-grey-1">
                            This QR code will be permanently linked to your Peanut profile. Anyone who scans it will be
                            able to use your invite.
                        </p>
                    </div>
                </Card>

                {/* How it works */}
                <Card className="space-y-3 p-6">
                    <h2 className="text-lg font-bold">How it works</h2>
                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary-1 text-sm font-bold">
                                1
                            </div>
                            <p className="text-sm text-grey-1">You claim this QR code and it becomes yours forever</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary-1 text-sm font-bold">
                                2
                            </div>
                            <p className="text-sm text-grey-1">Put the sticker anywhere you want people to find you</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary-1 text-sm font-bold">
                                3
                            </div>
                            <p className="text-sm text-grey-1">
                                They can join Peanut with your invite and contribute towards your points, forever.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Important note */}
                <Card className="border-2 border-secondary-1 bg-secondary-1/10 p-4">
                    <div className="flex gap-3">
                        <Icon name="info" size={20} className="flex-shrink-0 text-secondary-1" />
                        <p className="text-sm font-medium">
                            <strong>Important:</strong> Once claimed, this QR code cannot be transferred or changed.
                        </p>
                    </div>
                </Card>

                {/* Claim button - Hold to claim */}
                <Button
                    {...buttonProps}
                    variant="purple"
                    shadowSize="4"
                    disabled={isLoading}
                    loading={isLoading}
                    className={`${buttonProps.className} w-full`}
                >
                    {/* Black progress fill from left to right */}
                    <div
                        className="absolute inset-0 bg-black transition-all duration-100"
                        style={{
                            width: `${holdProgress}%`,
                            left: 0,
                        }}
                    />
                    <span className="relative z-10">{isLoading ? 'Claiming...' : 'Hold to Claim QR Code'}</span>
                </Button>

                {error && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}
