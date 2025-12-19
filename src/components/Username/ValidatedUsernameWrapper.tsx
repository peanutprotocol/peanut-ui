'use client'

/**
 * reusable component that validates a peanut username before rendering children
 *
 * use this when you need to:
 * - validate a username exists before showing content
 * - show consistent loading/error states during validation
 * - avoid repeating validation logic across different pages
 *
 * features:
 * - validates username via api call (HEAD request)
 * - shows loading spinner during validation
 * - shows error view if username is invalid
 * - renders children only after successful validation
 * - customizable error messages and loading styles
 *
 * example usage:
 * ```tsx
 * <ValidatedUsernameWrapper username="hugo">
 *   <PublicProfile username="hugo" />
 * </ValidatedUsernameWrapper>
 * ```
 */

import { useState, useEffect, type ReactNode } from 'react'
import { verifyPeanutUsername } from '@/lib/validation/recipient'
import type { ValidationErrorViewProps } from '@/components/Payment/Views/Error.validation.view'
import ValidationErrorView from '@/components/Payment/Views/Error.validation.view'
import PeanutLoading from '@/components/Global/PeanutLoading'

interface ValidatedUsernameWrapperProps {
    username: string
    children: ReactNode
    errorProps?: Partial<ValidationErrorViewProps>
    loadingClassName?: string
}

export function ValidatedUsernameWrapper({
    username,
    children,
    errorProps,
    loadingClassName = 'flex min-h-[calc(100dvh-180px)] w-full items-center justify-center',
}: ValidatedUsernameWrapperProps) {
    const [error, setError] = useState<ValidationErrorViewProps | null>(null)
    const [isValidating, setIsValidating] = useState(false)
    const [isValidated, setIsValidated] = useState(false)

    // validate username before showing children
    useEffect(() => {
        let isMounted = true

        const validateUsername = async () => {
            setIsValidating(true)
            setError(null)

            const isValid = await verifyPeanutUsername(username)

            if (!isMounted) return

            if (!isValid) {
                setError({
                    title: `We don't know any @${username}`,
                    message: 'Are you sure you clicked on the right link?',
                    buttonText: 'Go back to home',
                    redirectTo: '/home',
                    showLearnMore: false,
                    supportMessageTemplate: 'I clicked on this link but got an error: {url}',
                    ...errorProps,
                })
                setIsValidated(false)
            } else {
                setIsValidated(true)
            }

            setIsValidating(false)
        }

        validateUsername()

        return () => {
            isMounted = false
        }
    }, [username, errorProps])

    // show loading while validating
    if (isValidating) {
        return (
            <div className={loadingClassName}>
                <PeanutLoading />
            </div>
        )
    }

    // show error if validation failed
    if (error) {
        return (
            <div className="mx-auto h-full w-full space-y-8 self-center md:w-6/12">
                <ValidationErrorView {...error} />
            </div>
        )
    }

    // show children only after successful validation
    if (!isValidated) {
        return (
            <div className={loadingClassName}>
                <PeanutLoading />
            </div>
        )
    }

    return <>{children}</>
}
