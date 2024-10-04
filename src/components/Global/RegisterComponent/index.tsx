import { useContext, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import Loading from '../Loading'
import crypto from 'crypto'
import * as context from '@/context'
import { useAuth } from '@/context/authContext'
import Link from 'next/link'
import * as utils from '@/utils'
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
    const [loadingState, setLoadingState] = useState<string>('Idle')
    const isLoading = useMemo(() => loadingState !== 'Idle', [loadingState])
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

    const hashPassword = (
        password: string
    ): {
        salt: string
        hash: string
    } => {
        const salt = crypto.randomBytes(16).toString('hex')

        const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')

        return { salt, hash }
    }

    const handleOnSubmit = async (data: IRegisterForm) => {
        try {
            setLoadingState('Registering')
            const { salt, hash } = hashPassword(data.password)
            const registerResponse = await fetch('/api/peanut/user/register-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                    salt,
                    hash,
                    fullName: data.name,
                }),
            })

            await registerResponse.json()

            // If user already exists, login
            if (registerResponse.status === 409) {
                throw new Error('User already exists')
            } else if (registerResponse.status !== 200) {
                throw new Error('Error registering user')
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
            {errors.email && <span className="text-h9 font-normal text-red">{errors.email.message}</span>}

            <input
                {...register('password', { required: 'This field is required' })}
                className={`custom-input custom-input-xs ${errors.password ? 'border border-red' : ''}`}
                placeholder="Password"
                type="password"
                autoComplete="new-password"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleOnSubmit(watch())
                    }
                }}
            />
            {errors.password && <span className="text-h9 font-normal text-red">{errors.password.message}</span>}

            <button type="submit" className="btn btn-purple h-8 w-full text-h8" disabled={isLoading}>
                {isLoading ? (
                    <div className="flex w-full flex-row items-center justify-center gap-2 ">
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
                errorState.showError && (
                    <div className="w-full text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )
            )}
        </form>
    )
}
