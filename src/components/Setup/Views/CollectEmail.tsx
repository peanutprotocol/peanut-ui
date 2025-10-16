'use client'

import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const CollectEmail = () => {
    const [email, setEmail] = useState('')
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isLoading, setisLoading] = useState(false)
    const [error, setError] = useState('')
    const { user } = useAuth()
    const { handleNext } = useSetupFlow()

    const validateEmail = async (email: string) => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        return emailRegex.test(email)
    }

    const handleFinishSetup = async () => {
        try {
            setError('')
            setisLoading(true)
            const { error } = await updateUserById({
                userId: user?.user.userId,
                email,
            })

            if (error && error.includes('Unique constraint failed on the fields: (`email`)')) {
                setError('Email already in use.')
                return
            }

            if (error) {
                setError('Something went wrong. Please try again or contact support')
                return
            }
            await handleNext()
        } catch {
            setError('Something went wrong. Please try again or contact support')
        } finally {
            setisLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <ValidatedInput
                placeholder="Enter your email"
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

            {(!!error || (!isValid && !isChanging && !!email)) && <ErrorAlert description={error || 'Invalid email'} />}
        </div>
    )
}

export default CollectEmail
