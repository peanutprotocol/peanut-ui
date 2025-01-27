import { useAuth } from '@/context/authContext'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import Loading from '../Loading'

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
            name: name,
            email: email,
        },
    })
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const handleOnSubmit = async (data: IForm) => {
        try {
            setLoadingState('Submitting details')
            const response = await fetch('/api/peanut/user/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                    userId: user?.user.userId,
                    bridgeCustomerId: user?.user.bridge_customer_id,
                    fullName: data.name,
                }),
            })

            await response.json()

            // if email already exists, login
            if (response.status === 409) {
                throw new Error('Email already exists')
            } else if (response.status !== 200) {
                throw new Error('Error submitting details')
            }

            await fetchUser()
            onSubmit?.({ status: 'success', message: 'Details submitted successfully' })
        } catch (error) {
            console.error(error)

            if (error?.toString().includes('Email already exists')) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Email already exists',
                })
            } else {
                setErrorState({
                    showError: true,
                    errorMessage: 'Error submitting details, please try again',
                })
            }
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
                {...register('name', { required: 'This field is required' })}
                className={`custom-input custom-input-xs ${errors.name ? 'border border-red' : ''}`}
                placeholder="Full name"
                autoComplete="name"
            />
            {errors.name && <span className="text-h9 font-normal text-red">{errors.name.message}</span>}
            <input
                {...register('email', {
                    required: 'This field is required',
                    pattern: {
                        value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                        message: 'Invalid email address',
                    },
                })}
                className={`custom-input custom-input-xs ${errors.email ? 'border border-red' : ''}`}
                placeholder="Email"
                type="email"
                autoComplete="email"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleOnSubmit(watch())
                    }
                }}
            />
            {errors.email && <span className="text-start text-h9 font-normal text-red">{errors.email.message}</span>}

            <button type="submit" className="btn btn-purple h-8 w-full text-h8" disabled={isLoading}>
                {isLoading ? (
                    <div className="flex w-full flex-row items-center justify-center gap-2 ">
                        <Loading /> {loadingState}
                    </div>
                ) : (
                    'Submit details'
                )}
            </button>
            {errorState.showError && errorState.errorMessage === 'User already exists' ? (
                <div className="w-full">
                    <span className="text-start text-h8 font-normal">User already exists</span>
                </div>
            ) : (
                errorState.showError && (
                    <div className="w-full text-start">
                        <label className="text-start text-h8 font-normal text-red">{errorState.errorMessage}</label>
                    </div>
                )
            )}
        </form>
    )
}
