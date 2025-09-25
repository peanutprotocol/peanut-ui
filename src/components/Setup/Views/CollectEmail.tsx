'use client'

import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const CollectEmail = () => {
    const [email, setEmail] = useState('')
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isLoading, setisLoading] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()

    const validateEmail = async (email: string) => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        return emailRegex.test(email)
    }

    const handleFinishSetup = async () => {
        try {
            setError('')
            setisLoading(true)
            await updateUserById({ email })
            setisLoading(false)
            router.push('/home')
        } catch {
            setError('Something went wrong. Please try again or contact support')
        } finally {
            setisLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <ValidatedInput
                placeholder="Enter you email"
                value={email}
                debounceTime={750}
                validate={validateEmail}
                onUpdate={({ value, isValid, isChanging }) => {
                    setIsValid(isValid)
                    setIsChanging(isChanging)
                    setEmail(value)
                }}
                isSetupFlow
                isInputChanging={isChanging}
                className={twMerge(
                    !isValid && !isChanging && !!email && 'border-error dark:border-error',
                    isValid && !isChanging && !!email && 'border-secondary-8 dark:border-secondary-8',
                    'rounded-sm'
                )}
            />

            <Button
                className="h-12 "
                loading={isLoading}
                shadowSize="4"
                onClick={handleFinishSetup}
                disabled={!isValid || isChanging || isLoading}
            >
                Finish setup
            </Button>

            {error || (!isValid && !isChanging && !!email && <ErrorAlert description={error || 'Invalid email'} />)}
        </div>
    )
}

export default CollectEmail
