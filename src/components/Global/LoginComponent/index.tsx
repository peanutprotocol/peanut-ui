import { useContext, useState } from 'react'
import { useForm } from 'react-hook-form'
import Loading from '../Loading'

import * as context from '@/context'
import { useAuth } from '@/context/authContext'

interface ILoginComponentProps {
    email?: string
    password?: string
    onSubmit?: (status: 'success' | 'error' | 'login', message: string) => void
    redirectUrl?: string
}

interface ILoginForm {
    email: string
    password: string
}

export const GlobalLoginComponent = ({ email, password, onSubmit, redirectUrl }: ILoginComponentProps) => {
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const { fetchUser } = useAuth()
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<ILoginForm>({
        mode: 'onChange',
        defaultValues: {
            email: email,
            password: password,
        },
    })

    const handleOnSubmit = async (data: ILoginForm) => {
        try {
            setLoadingState('Loading')
            console.log(data)
            const loginResponse = await fetch('/api/peanut/user/login-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                }),
            })
            const login = await loginResponse.json()

            if (loginResponse.status !== 200) {
                if (login === 'Invalid email format') {
                    setError('email', {
                        type: 'validate',
                        message: 'Invalid email format',
                    })
                } else if (login === 'Invalid email, userId') {
                    setError('email', {
                        type: 'validate',
                        message: 'Incorrect email',
                    })
                } else if (login === 'Invalid password') {
                    setError('password', {
                        type: 'validate',
                        message: 'Invalid password',
                    })
                } else if (login === 'User not found') {
                    setError('email', {
                        type: 'validate',
                        message: 'User not found',
                    })
                }

                return
            }
            await fetchUser()
            onSubmit?.('success', 'User registered successfully')
            if (redirectUrl) {
                window.location.href = redirectUrl
            }
        } catch (error) {
            console.error(error)
            onSubmit?.('error', 'An error occurred')
            setErrorState({ showError: true, errorMessage: 'Please make sure you are using the right credentials' })
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <form className="flex w-full flex-col items-start justify-center gap-2" onSubmit={handleSubmit(handleOnSubmit)}>
            <input
                {...register('email', { required: 'This field is required' })}
                className={`custom-input custom-input-xs ${errors.email ? 'border border-red' : ''}`}
                placeholder="Email"
                type="email"
            />
            {errors.email && <span className="text-h9 font-normal text-red">{errors.email.message}</span>}

            <input
                {...register('password', { required: 'This field is required' })}
                className={`custom-input custom-input-xs ${errors.password ? 'border border-red' : ''}`}
                placeholder="Password"
                type="password"
            />
            {errors.password && <span className="text-h9 font-normal text-red">{errors.password.message}</span>}

            <button type="submit" className="btn btn-purple h-8 w-full" disabled={isLoading}>
                {isLoading ? (
                    <div className="flex w-full flex-row items-center justify-center gap-2">
                        <Loading /> {loadingState}
                    </div>
                ) : (
                    'Login'
                )}
            </button>
            {errorState.showError && (
                <div className="text-center">
                    <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                </div>
            )}
        </form>
    )
}
