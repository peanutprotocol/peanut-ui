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
import { useTranslations } from 'next-intl'
import { verifyPeanutUsername } from '@/lib/validation/recipient'
import type { ValidationErrorViewProps } from '@/components/Payment/Views/Error.validation.view'
import ValidationErrorView from '@/components/Payment/Views/Error.validation.view'
import Loading from '@/components/Global/Loading'

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
    loadingClassName = 'flex min-h-[inherit] w-full items-center justify-center',
}: ValidatedUsernameWrapperProps) {
    const t = useTranslations('payment')
    const [isInvalid, setIsInvalid] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [isValidated, setIsValidated] = useState(false)

    // validate username before showing children
    useEffect(() => {
        let isMounted = true

        const validateUsername = async () => {
            setIsValidating(true)
            setIsInvalid(false)

            const isValid = await verifyPeanutUsername(username)

            if (!isMounted) return

            if (!isValid) {
                setIsInvalid(true)
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
    }, [username])

    // show loading while validating
    if (isValidating) {
        return (
            <div className={loadingClassName}>
                <Loading variant="mascot" />
            </div>
        )
    }

    // show error if validation failed. the strings are translated at render,
    // not stored at validation time: IntlCore swaps the locale catalog in
    // asynchronously, so a stored translation could stay English on cold loads.
    if (isInvalid) {
        return (
            <div className="mx-auto space-y-8 h-full w-full self-center md:w-6/12">
                <ValidationErrorView
                    title={t('validation.unknownUser.title', { username })}
                    message={t('validation.unknownUser.message')}
                    buttonText={t('validation.unknownUser.cta')}
                    redirectTo="/home"
                    showLearnMore={false}
                    // the literal {url} placeholder is replaced by the error view, not next-intl
                    supportMessageTemplate={t('validation.unknownUser.supportTemplate')}
                    {...errorProps}
                />
            </div>
        )
    }

    // show children only after successful validation
    if (!isValidated) {
        return (
            <div className={loadingClassName}>
                <Loading variant="mascot" />
            </div>
        )
    }

    return <>{children}</>
}
