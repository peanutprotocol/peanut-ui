import { useContext } from 'react'
import { useForm } from 'react-hook-form'
import Loading from '../Loading'

import * as context from '@/context'
import { useAuth } from '@/context/authContext'

interface IRegisterComponentProps {
    userId?: string
    name?: string
    email?: string
    password?: string
    onSubmit?: (status: 'success' | 'error' | 'login', message: string) => void
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
    } = useForm<IRegisterForm>({
        mode: 'onBlur',
        defaultValues: {
            name: name,
            email: email,
            password: password,
        },
    })

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
                    userId: userId,
                }),
            })

            const register = await registerResponse.json()

            // If user already exists, login
            if (registerResponse.status === 409) {
                console.log(register.userId)
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
                    console.log(login)
                    if (login === 'Invalid email format') {
                        errors.email = {
                            message: 'Invalid email format',
                            type: 'validate',
                        }
                    }
                    if (login === 'Invalid email, userId') {
                        errors.email = {
                            message: 'Incorrect email',
                            type: 'validate',
                        }
                    } else if (login === 'Invalid password') {
                        errors.password = {
                            message: 'Invalid password',
                            type: 'validate',
                        }
                    }

                    return
                }
            }

            await fetchUser()
            onSubmit?.('success', 'User registered successfully')
            redirectUrl ?? window.location.href == redirectUrl
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <form className="flex w-full flex-col items-start justify-center gap-2">
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
        </form>
    )
}
