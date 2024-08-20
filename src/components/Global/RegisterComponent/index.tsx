import { useContext, useState } from 'react'
import { useForm } from 'react-hook-form'
import Loading from '../Loading'

import * as context from '@/context'
import { useAuth } from '@/context/authContext'
import Link from 'next/link'

interface IRegisterComponentProps {
    userId?: string
    name?: string
    email?: string
    password?: string
    onSubmit?: ({ status, message }: { status: 'success' | 'error' | 'login'; message: string }) => void
    redirectUrl?: string
}

interface IRegisterForm {
    name: string
    email: string
    password: string
}

export const GlobalRegisterComponent = ({
    userId,
    name,
    email,
    password,
    onSubmit,
    redirectUrl,
}: IRegisterComponentProps) => {
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const { fetchUser } = useAuth()
    const {
        register,
        watch,
        formState: { errors },
        handleSubmit,
    } = useForm<IRegisterForm>({
        mode: 'onBlur',
        defaultValues: {
            name: name,
            email: email,
            password: password,
        },
    })
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const handleOnSubmit = async (data: IRegisterForm) => {
        try {
            setLoadingState('Registering')
            const registerResponse = await fetch('/api/peanut/user/register-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                    password: data.password,
                    fullName: data.name,
                }),
            })

            const register = await registerResponse.json()

            // If user already exists, login
            if (registerResponse.status === 409) {
                throw new Error('User already exists')
            }

            await fetchUser()
            onSubmit?.({ status: 'success', message: 'User registered successfully' })
            redirectUrl ?? window.location.href == redirectUrl
        } catch (error) {
            console.error(error)

            if (error?.toString().includes('User already exists')) {
                setErrorState({
                    showError: true,
                    errorMessage: 'User already exists',
                })
            } else {
                setErrorState({
                    showError: true,
                    errorMessage: 'Error registering user',
                })
            }
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <form className="flex w-full flex-col items-start justify-center gap-2" onSubmit={handleSubmit(handleOnSubmit)}>
            <input
                {...register('name', { required: 'This field is required' })}
                className={`custom-input custom-input-xs ${errors.name ? 'border border-red' : ''}`}
                placeholder="Full name"
            />
            {errors.name && <span className="text-h9 font-normal text-red">{errors.name.message}</span>}
            <input
                {...register('email', { required: 'This field is required' })}
                className={`custom-input custom-input-xs ${errors.email ? 'border border-red' : ''}`}
                placeholder="Email"
                type="email"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleOnSubmit(watch())
                    }
                }}
            />
            {errors.email && <span className="text-h9 font-normal text-red">{errors.email.message}</span>}

            <input
                {...register('password', { required: 'This field is required' })}
                className={`custom-input custom-input-xs ${errors.password ? 'border border-red' : ''}`}
                placeholder="Password"
                type="password"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleOnSubmit(watch())
                    }
                }}
            />
            {errors.password && <span className="text-h9 font-normal text-red">{errors.password.message}</span>}

            <button type="submit" className="btn btn-purple h-8 w-full" disabled={isLoading}>
                {isLoading ? (
                    <div className="flex w-full flex-row items-center justify-center gap-2">
                        <Loading /> {loadingState}
                    </div>
                ) : (
                    'Register'
                )}
            </button>
            {errorState.showError && errorState.errorMessage === 'User already exists' ? (
                <div className="w-full text-center">
                    <span className=" text-h8 font-normal ">
                        User already exists, click{' '}
                        <Link href={'/login'} className="underline">
                            {' '}
                            here{' '}
                        </Link>{' '}
                        to login
                    </span>
                </div>
            ) : (
                <div className="w-full text-center">
                    <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                </div>
            )}
        </form>
    )
}
