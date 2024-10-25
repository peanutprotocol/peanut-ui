import { useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useAuth } from '@/context/authContext'
import crypto from 'crypto'
import { Button, Field } from '@/components/0_Bruddle'

interface ILoginComponentProps {
    email?: string
    password?: string
    onSubmit?: ({ status, message }: { status: 'success' | 'error' | 'login'; message: string }) => void
    redirectUrl?: string
}

interface ILoginForm {
    email: string
    password: string
}

export const GlobalLoginComponent = ({ email, password, onSubmit, redirectUrl }: ILoginComponentProps) => {
    const [loadingState, setLoadingState] = useState<string>('Idle')
    const isLoading = useMemo(() => loadingState !== 'Idle', [loadingState])
    const { fetchUser } = useAuth()
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const methods = useForm<ILoginForm>({
        mode: 'onChange',
        defaultValues: {
            email: email,
            password: password,
        },
    })

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = methods

    const handleOnSubmit = async (data: ILoginForm) => {
        try {
            setLoadingState('Loading')
            console.log(data)

            const saltResponse = await fetch('/api/peanut/user/get-user-salt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: data.email }),
            })

            if (saltResponse.status !== 200) {
                const errorData = await saltResponse.json()
                console.error('Failed to retrieve salt:', errorData)
                setError('email', {
                    type: 'validate',
                    message: 'User not found',
                })
                return
            }

            const { salt } = await saltResponse.json()

            const hash = crypto.pbkdf2Sync(data.password, salt, 10000, 64, 'sha512').toString('hex')

            const loginResponse = await fetch('/api/peanut/user/login-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: data.email,
                    hash: hash,
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
                } else {
                    setErrorState({
                        showError: true,
                        errorMessage: 'Login Error',
                    })
                }

                return
            }
            await fetchUser()
            onSubmit?.({ status: 'success', message: 'User registered successfully' })
            if (redirectUrl) {
                window.location.href = redirectUrl
            }
        } catch (error) {
            console.error(error)
            setErrorState({ showError: true, errorMessage: 'Please make sure you are using the right credentials' })
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <FormProvider {...methods}>
            <form
                className="flex w-full flex-col items-start justify-center gap-2"
                onSubmit={handleSubmit(handleOnSubmit)}
            >
                <Field
                    label="Email"
                    {...register('email', {
                        required: 'This field is required',
                        pattern: {
                            value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                            message: 'Invalid email address',
                        },
                    })}
                    placeholder="Email"
                    type="email"
                    autoComplete="username"
                />

                {errors.email && <span className="text-red-500 text-h9 font-normal">{errors.email.message}</span>}

                <Field
                    label="Password"
                    {...register('password', { required: 'This field is required' })}
                    placeholder="Password"
                    type="password"
                    autoComplete="current-password"
                />
                {errors.password && <span className="text-red-500 text-h9 font-normal">{errors.password.message}</span>}
                <Button type="submit" disabled={isLoading} className="mt-2" loading={isLoading}>
                    Login
                </Button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-red-500 text-h8 font-normal ">{errorState.errorMessage}</label>
                    </div>
                )}
            </form>
        </FormProvider>
    )
}
