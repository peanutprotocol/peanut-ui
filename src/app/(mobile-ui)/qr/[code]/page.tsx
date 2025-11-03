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

    // If already claimed, redirect to target URL (for both logged in and logged out users)
    useEffect(() => {
        if (redirectQrData?.claimed && redirectQrData?.redirectUrl) {
            // Extract the path from the URL to keep it on the same domain (localhost vs production)
            console.log('[QR Claim] QR is claimed, redirecting to:', redirectQrData.redirectUrl)
            try {
                const url = new URL(redirectQrData.redirectUrl)
                const invitePath = `${url.pathname}${url.search}` // e.g., /invite?code=XYZINVITESYOU
                console.log('[QR Claim] Extracted invite path:', invitePath)
                console.log('[QR Claim] User state:', user ? `logged in as ${user.user?.username}` : 'not logged in')
                router.push(invitePath)
            } catch (error) {
                console.error('[QR Claim] Failed to parse redirectUrl, using full URL', error)
                // Fallback to full URL if parsing fails
                window.location.href = redirectQrData.redirectUrl
            }
        }
    }, [redirectQrData, router, user])

    // Check authentication and redirect if needed (only if QR is not claimed)
    useEffect(() => {
        console.log('[QR Claim] Auth check:', {
            isCheckingStatus,
            hasUser: !!user,
            hasClaimed: redirectQrData?.claimed,
            hasRedirectUrl: !!redirectQrData?.redirectUrl,
        })

        if (!isCheckingStatus && !user && redirectQrData && !redirectQrData.claimed) {
            console.log('[QR Claim] QR is unclaimed and user not logged in, redirecting to setup')
            // Save current URL to redirect back after login
            saveRedirectUrl()
            router.push('/setup')
        }
    }, [user, isCheckingStatus, router, redirectQrData])

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

    // Show loading while checking status, not logged in, or if QR is claimed (redirecting)
    if (isCheckingStatus || !user || (redirectQrData?.claimed && redirectQrData?.redirectUrl)) {
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
                                Anyone scanning it can send you money or connect with you
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
