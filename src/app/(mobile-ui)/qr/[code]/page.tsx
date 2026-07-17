'use client'

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { serverFetch } from '@/utils/api-fetch'
import { useAuth } from '@/context/authContext'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import { saveRedirectUrl, generateInviteCodeLink, sanitizeRedirectURL } from '@/utils/general.utils'
import { getShakeClass } from '@/utils/perk.utils'
import { useRedirectQrStatus } from '@/hooks/useRedirectQrStatus'
import { HoldToClaimButton } from '@/components/Global/HoldToClaimButton'
import type { ShakeIntensity } from '@/hooks/useHoldToClaim'
import { qrSuccessUrl } from '@/utils/native-routes'

export default function RedirectQrClaimPage() {
    const t = useTranslations('qrPay')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const router = useRouter()
    const params = useParams()
    const searchParams = useSearchParams()
    const code = (params?.code as string) || searchParams.get('code') || ''
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
                        setError(t('claim.invalidDestination'))
                    }
                } catch {
                    console.error('Invalid redirect URL:', redirectQrData.redirectUrl)
                    setError(t('claim.invalidDestination'))
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

            const response = await serverFetch(`/qr/${code}/claim`, {
                method: 'POST',
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
            router.push(qrSuccessUrl(code))
        } catch (err: any) {
            console.error('Error claiming QR:', err)
            // Always show generic error message (don't expose backend details)
            setError(t('claim.claimFailed'))
        } finally {
            setIsLoading(false)
        }
    }, [code, router, user, t])

    // Shake state surfaced by <HoldToClaimButton /> so the surrounding
    // column shakes with the button — same scope as the eligibility-check.
    const [shake, setShake] = useState<{ on: boolean; intensity: ShakeIntensity }>({
        on: false,
        intensity: 'none',
    })

    // Show loading while checking status or if we're in the process of redirecting
    if (isCheckingStatus || (redirectQrData?.claimed && redirectQrData?.redirectUrl)) {
        return (
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(shake.on, shake.intensity)}`}>
                <NavHeader title={tLoading('loading')} />
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
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(shake.on, shake.intensity)}`}>
                <NavHeader title={tLoading('loading')} />
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
            <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(shake.on, shake.intensity)}`}>
                <NavHeader title={t('claim.navTitle')} />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="space-y-4 p-6">
                        <div className="flex items-center justify-center">
                            <div className="bg-red-100 flex h-16 w-16 items-center justify-center rounded-full">
                                <Icon name="cancel" size={32} className="text-red-600" />
                            </div>
                        </div>
                        <div className="space-y-2 text-center">
                            <h1 className="text-2xl font-extrabold">{t('claim.unavailableTitle')}</h1>
                            <p className="text-base text-grey-1">
                                {redirectQrData?.claimed ? t('claim.alreadyClaimed') : t('claim.notAvailable')}
                            </p>
                        </div>
                    </Card>
                    <Button variant="purple" shadowSize="4" onClick={() => router.push('/home')} className="w-full">
                        {tCommon('goToHome')}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className={`flex min-h-[inherit] flex-col gap-8 ${getShakeClass(shake.on, shake.intensity)}`}>
            <NavHeader title={t('claim.inviteQrTitle')} />
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* QR Code Visual */}
                <Card className="space-y-4 p-6">
                    <div className="flex items-center justify-center">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full">
                            <Icon name="qr-code" size={64} className="text-purple-600" />
                        </div>
                    </div>
                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl font-extrabold">{t('claim.inviteQrTitle')}</h1>
                        <p className="text-base text-grey-1">{t('claim.inviteQrDescription')}</p>
                    </div>
                </Card>

                {/* Important note */}
                <Card className="border-2 border-secondary-1 bg-secondary-1/10 p-4">
                    <div className="flex gap-3">
                        <Icon name="info" size={20} className="flex-shrink-0 text-secondary-1" />
                        <p className="text-sm font-medium">
                            {t.rich('claim.permanentNote', { strong: (chunks) => <strong>{chunks}</strong> })}
                        </p>
                    </div>
                </Card>

                {/* Claim button — DRY with /card eligibility-check via
                    <HoldToClaimButton />. */}
                <HoldToClaimButton
                    onComplete={handleClaim}
                    disabled={isLoading}
                    loading={isLoading}
                    onShakeChange={(on, intensity) => setShake({ on, intensity })}
                >
                    {isLoading ? t('claim.claiming') : t('claim.holdToClaim')}
                </HoldToClaimButton>

                {error && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}
