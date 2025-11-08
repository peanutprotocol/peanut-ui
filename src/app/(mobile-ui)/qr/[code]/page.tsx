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
import { saveRedirectUrl, generateInviteCodeLink, sanitizeRedirectURL } from '@/utils'
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
            // Sanitize redirect URL to prevent open redirect attacks
            // For same-origin URLs, sanitizeRedirectURL returns safe path
            // For external URLs, it returns null (we handle separately)
            const sanitizedPath = sanitizeRedirectURL(redirectQrData.redirectUrl)

            if (sanitizedPath) {
                // Internal redirect - use sanitized path with Next.js router
                router.push(sanitizedPath)
            } else {
                // External redirect - validate it's expected domain before redirecting
                try {
                    const url = new URL(redirectQrData.redirectUrl)
                    // Allow external redirects ONLY for trusted domains (peanut.me)
                    // This relies on backend validation during QR claiming
                    if (url.hostname.includes('peanut.me') || url.hostname.includes('localhost')) {
                        window.location.href = redirectQrData.redirectUrl
                    } else {
                        console.error('Untrusted external redirect blocked:', redirectQrData.redirectUrl)
                        setError('Invalid QR code destination.')
                    }
                } catch (error) {
                    console.error('Invalid redirect URL:', redirectQrData.redirectUrl)
                    setError('Invalid QR code destination.')
                }
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
            // Generate invite link with correct 3-digit suffix
            const username = user?.user?.username
            if (!username) {
                throw new Error('Username not found')
            }

            const { inviteLink } = generateInviteCodeLink(username)

            const response = await fetch(`${PEANUT_API_URL}/qr/${code}/claim`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                },
                body: JSON.stringify({
                    targetUrl: inviteLink, // Pass the correctly formatted invite link
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                // Log backend error for debugging but show generic message to user
                console.error('Backend claim error:', data.message || data.error)
                throw new Error('Failed to claim QR code. Please try again.')
            }

            // Success! Show success page, then redirect to invite (which goes to profile for logged-in users)
            router.push(`/qr/${code}/success`)
        } catch (err: any) {
            console.error('Error claiming QR:', err)
            // Always show generic error message (don't expose backend details)
            setError('Failed to claim QR code. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }, [code, router, user])

    // Hold-to-claim mechanics with shake animation
    const { holdProgress, isShaking, shakeIntensity, buttonProps } = useHoldToClaim({
        onComplete: handleClaim,
        disabled: isLoading,
    })

    // Show loading while checking status or if we're in the process of redirecting
    if (isCheckingStatus || (redirectQrData?.claimed && redirectQrData?.redirectUrl)) {
        return (
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
                <NavHeader title="Loading" />
                <div className="my-auto flex h-full items-center justify-center">
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
                <NavHeader title="Loading" />
                <div className="my-auto flex h-full items-center justify-center">
                    <PeanutLoading />
                </div>
            </div>
        )
    }

    // Show error only if there's an actual error or QR is not available (and not claimed)
    if (redirectQrError || !redirectQrData || (!redirectQrData.available && !redirectQrData.claimed)) {
        // Log error for debugging but don't expose details to user
        if (redirectQrError) {
            console.error('QR status check error:', redirectQrError)
        }
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
            <NavHeader title="Your Invite QR" />
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* QR Code Visual */}
                <Card className="space-y-4 p-6">
                    <div className="flex items-center justify-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full">
                            <Icon name="qr-code" size={40} className="text-purple-600" />
                        </div>
                    </div>
                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl font-extrabold">Your Invite QR</h1>
                        <p className="text-base text-grey-1">
                            Share anywhere. Points keep coming from the activity of friends & their friends.
                        </p>
                        <p className="pt-2 text-sm text-grey-1">
                            <strong>Note:</strong> Permanent once claimed.
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
                    <span className="relative z-10">{isLoading ? 'Claiming...' : 'Hold to make it yours forever'}</span>
                </Button>

                {error && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}
