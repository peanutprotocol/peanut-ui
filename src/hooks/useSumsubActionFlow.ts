import { useState, useCallback, useRef } from 'react'

export interface ActionFlowResponse {
    token: string | null
    status: string
    message?: string
    applicantId?: string | null
}

interface ActionTokenFetcher {
    (): Promise<{ data?: ActionFlowResponse; error?: string }>
}

interface UseSumsubActionFlowOptions {
    /** server action that returns { token, status, message? } */
    fetchToken: ActionTokenFetcher
    onSuccess?: () => void
    /** called when the backend says the user should contact support instead */
    onNeedsSupport?: () => void
}

/**
 * Hook for Sumsub verification flows triggered outside the main KYC path.
 * Used for BR limit increase (LATAM KYC level) and reusable for future
 * flows like Rain card application.
 *
 * Handles three backend response states:
 * - completed: documents were found and uploaded server-side, no SDK needed
 * - pending: SDK token returned, user needs to complete verification
 * - needs_support: edge case requiring manual support
 */
export function useSumsubActionFlow({ fetchToken, onSuccess, onNeedsSupport }: UseSumsubActionFlowOptions) {
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [showWrapper, setShowWrapper] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isComplete, setIsComplete] = useState(false)

    const fetchTokenRef = useRef(fetchToken)
    fetchTokenRef.current = fetchToken
    const onSuccessRef = useRef(onSuccess)
    onSuccessRef.current = onSuccess
    const onNeedsSupportRef = useRef(onNeedsSupport)
    onNeedsSupportRef.current = onNeedsSupport

    const handleInitiate = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        setIsComplete(false)

        try {
            const response = await fetchTokenRef.current()

            if (response.error) {
                setError(response.error)
                return
            }

            if (!response.data) {
                setError('No response from server. Please try again.')
                return
            }

            const { status, token, message } = response.data

            if (status === 'completed') {
                // backend found documents and uploaded them — no SDK needed
                setIsComplete(true)
                onSuccessRef.current?.()
                return
            }

            if (status === 'needs_support') {
                // edge case: user needs to contact support — open support modal only
                onNeedsSupportRef.current?.()
                return
            }

            if (token) {
                setAccessToken(token)
                setShowWrapper(true)
            } else {
                setError(message || 'Could not start document verification. Please try again.')
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'An unexpected error occurred'
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // called when SDK signals verification was submitted
    const handleSdkComplete = useCallback(() => {
        setShowWrapper(false)
        setIsComplete(true)
        onSuccessRef.current?.()
    }, [])

    // called when user manually closes the SDK — reset state and refetch
    // in case they completed a multi-level flow before closing
    const handleClose = useCallback(() => {
        setShowWrapper(false)
        setAccessToken(null)
        setError(null)
        onSuccessRef.current?.()
    }, [])

    // token refresh for the SDK
    const refreshToken = useCallback(async (): Promise<string> => {
        const response = await fetchTokenRef.current()

        if (response.error || !response.data?.token) {
            throw new Error(response.error || 'Failed to refresh token')
        }

        setAccessToken(response.data.token)
        return response.data.token
    }, [])

    return {
        isLoading,
        error,
        showWrapper,
        accessToken,
        isComplete,
        handleInitiate,
        handleSdkComplete,
        handleClose,
        refreshToken,
    }
}
