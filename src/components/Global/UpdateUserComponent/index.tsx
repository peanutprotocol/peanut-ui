import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { getUserLinks } from '@/utils/cashout.utils'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import Loading from '../Loading'
import { fetchWithSentry } from '@/utils'
import * as Sentry from '@sentry/nextjs'

interface IUpdateUserComponentProps {
    userId?: string
    name?: string
    email?: string
    password?: string
    onSubmit?: ({ status, message }: { status: 'success' | 'error' | 'login'; message: string }) => void
}

interface IForm {
    name: string
    email: string
}

export const UpdateUserComponent = ({ name, email, onSubmit }: IUpdateUserComponentProps) => {
    const [loadingState, setLoadingState] = useState<string>('Idle')
    const isLoading = useMemo(() => loadingState !== 'Idle', [loadingState])
    const { fetchUser, user } = useAuth()
    const {
        register,
        watch,
        formState: { errors },
        handleSubmit,
    } = useForm<IForm>({
        mode: 'onBlur',
        defaultValues: {
            name: name || user?.user?.full_name || '',
            email: email || user?.user?.email || '',
        },
    })
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const handleOnSubmit = async (data: IForm) => {
        try {
            setLoadingState('Creating your profile')

            // validate form data
            if (!data.name?.trim() || !data.email?.trim()) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please provide both your name and email address.',
                })
                return
            }

            // only create bridge customer if we don't have one
            let bridgeCustomerId = user?.user?.bridge_customer_id

            if (!bridgeCustomerId) {
                setLoadingState('Setting up your account')
                try {
                    console.log('Creating bridge customer with:', data)

                    const bridgeCustomer = await getUserLinks({
                        full_name: data.name.trim(),
                        email: data.email.trim(),
                    })

                    console.log('Bridge customer created:', bridgeCustomer)

                    // get the correct customer_id from the response

                    bridgeCustomerId = bridgeCustomer.customer_id
                } catch (error) {
                    console.error('Failed to create Bridge customer:', error)
                    setErrorState({
                        showError: true,
                        errorMessage: 'Unable to set up your account. Please try again or contact support.',
                    })
                    Sentry.captureException(error)
                    return
                }
            }

            if (!bridgeCustomerId) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Failed to create customer ID. Please try again.',
                })
                return
            }

            setLoadingState('Saving your details')
            const response = await fetchWithSentry('/api/peanut/user/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email.trim(),
                    userId: user?.user.userId,
                    bridgeCustomerId,
                    fullName: data.name.trim(),
                }),
            })

            await response.json()

            if (response.status === 409) {
                setErrorState({
                    showError: true,
                    errorMessage: 'This email is already registered. Please use a different email.',
                })
                return
            }

            if (response.status !== 200) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Unable to save your details. Please try again.',
                })
                return
            }

            await fetchUser()
            onSubmit?.({ status: 'success', message: 'Profile updated successfully' })
        } catch (error) {
            console.error('Error in profile update:', error)
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong. Please try again or contact support.',
            })
            Sentry.captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <form
            className="flex w-full flex-col items-stretch justify-center gap-2"
            onSubmit={handleSubmit(handleOnSubmit)}
        >
            <input
                {...register('name', { required: 'Full name is required' })}
                className={`custom-input custom-input-xs ${errors.name ? 'border border-red' : ''}`}
                placeholder="Full name"
                autoComplete="name"
            />
            {errors.name && <span className="text-h9 font-normal text-red">{errors.name.message}</span>}
            <input
                {...register('email', {
                    required: 'Email address is required',
                    pattern: {
                        value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                        message: 'Please enter a valid email address',
                    },
                })}
                className={`custom-input custom-input-xs ${errors.email ? 'border border-red' : ''}`}
                placeholder="Email"
                type="email"
                autoComplete="email"
            />
            {errors.email && <span className="text-start text-h9 font-normal text-red">{errors.email.message}</span>}

            <Button type="submit" variant="purple" size="small" disabled={isLoading}>
                {isLoading ? (
                    <div className="flex w-full flex-row items-center justify-center gap-2 ">
                        <Loading /> {loadingState}
                    </div>
                ) : (
                    'Submit details'
                )}
            </Button>
            {errorState.showError && (
                <div className="w-full text-start">
                    <label className="text-start text-h8 font-normal text-red">{errorState.errorMessage}</label>
                </div>
            )}
        </form>
    )
}
