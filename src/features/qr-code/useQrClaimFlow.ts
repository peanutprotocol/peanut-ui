'use client'

import type { ShakeIntensity } from '@/hooks/useHoldToClaim'
import { useAuth } from '@/context/authContext'
import { useRedirectQrStatus } from '@/hooks/useRedirectQrStatus'
import { serverFetch } from '@/utils/api-fetch'
import { generateInviteCodeLink, sanitizeRedirectURL, saveRedirectUrl } from '@/utils/general.utils'
import { qrSuccessUrl } from '@/utils/native-routes'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'
import { useCallback, useEffect, useState } from 'react'

/**
 * flow hook for the redirect-qr claim page — owns the status fetch, the
 * redirect/auth effect and the claim action so the page and views stay dumb
 * (same model as features/home/useHomeFlow).
 */
export function useQrClaimFlow() {
    const t = useTranslations('qrPay')
    const router = useRouter()
    const params = useParams()
    // read-only fallback for /qr?code=... — nuqs per the url-as-state rule
    const [queryCode] = useQueryState('code', parseAsString)
    const code = (params?.code as string) || queryCode || ''
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
        } catch (err) {
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

    return {
        user,
        redirectQrData,
        isCheckingStatus,
        redirectQrError,
        isLoading,
        error,
        shake,
        setShake,
        handleClaim,
    }
}
