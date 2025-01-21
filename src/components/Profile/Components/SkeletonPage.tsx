import * as assets from '@/assets'
import Loading from '@/components/Global/Loading'
import { GlobalLoginComponent } from '@/components/Global/LoginComponent'
import { GlobalRegisterComponent } from '@/components/Global/RegisterComponent'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useState } from 'react'

type ProfileSkeletonProps = {
    onClick: () => void
    showOverlay?: boolean
    errorState: {
        showError: boolean
        errorMessage: string
    }
    isLoading: boolean
}

/**
 * ProfileSkeleton is a component that displays a loading skeleton for the profile section of the app.
 * It shows animated placeholders while loading or when there is no data.
 * Additionally, it handles user login or registration, with an overlay that prompts users to log in or connect a wallet.
 * It also handles error states, providing feedback when login or registration encounters an issue.
 */
export const ProfileSkeleton = ({ onClick, showOverlay = true, errorState, isLoading }: ProfileSkeletonProps) => {
    const { address, signInModal } = useWallet()
    const [userState, setUserState] = useState<'login' | 'register'>('login')

    return (
        <div className="relative flex h-full w-full flex-row flex-col items-center justify-start gap-4 px-4">
            <div className="relative z-0 flex w-full flex-col items-center justify-center gap-2">
                <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
                    <div className="flex w-full flex-col items-center justify-center gap-2 sm:w-max sm:flex-row">
                        <div className="h-16 w-16 animate-pulse rounded-sm bg-slate-700"></div>
                        <div className="flex flex-col items-center justify-center gap-1 sm:items-start">
                            <span className="h-8 w-32 animate-pulse rounded bg-slate-700"></span>
                        </div>
                    </div>
                    <div className="flex h-24 w-full animate-pulse flex-col items-start justify-center gap-2 rounded-sm border border-n-1 bg-slate-700 px-4 py-2 text-h7 sm:w-96"></div>
                </div>
                <div className="flex w-full flex-col items-center justify-center gap-2 pb-2">
                    <div className="mx-0 flex w-full flex-row items-center justify-center gap-1 px-0">
                        <span className="h-8 w-1/3 animate-pulse rounded-none bg-slate-700"></span>
                        <span className="h-8 w-1/3  animate-pulse rounded-none bg-slate-700"></span>
                        <span className="h-8 w-1/3 animate-pulse rounded-none bg-slate-700"></span>
                    </div>
                    <table className="table-custom hidden bg-background sm:table">
                        <thead>
                            <tr className="h-16">
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                                <th className="th-custom-skeleton">
                                    {' '}
                                    <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...Array(3)].map((_, idx) => (
                                <tr key={idx}>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                    <td className="td-custom-skeleton">
                                        <span className="block h-6 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="block w-full sm:hidden">
                        {[...Array(3)].map((_, idx) => (
                            <div
                                className="flex w-full flex-row items-center justify-between gap-2 border border-n-1 bg-background px-2 py-4 text-h8 font-normal dark:bg-black"
                                key={idx}
                            >
                                <span className="block h-12 w-12 animate-pulse rounded bg-slate-700"></span>

                                <div className="flex w-full flex-col gap-2">
                                    <div className="flex flex-row items-center justify-between">
                                        <span className="block h-4 w-12 animate-pulse rounded bg-slate-700"></span>
                                        <span className="block h-4 w-12 animate-pulse rounded bg-slate-700"></span>
                                    </div>
                                    <div className="flex w-full border-t border-dotted border-black" />
                                    <span className="block h-4 w-24 animate-pulse rounded bg-slate-700"></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showOverlay && (
                <div className="absolute inset-0 -top-2 z-10 flex items-center justify-center backdrop-blur-sm">
                    <div className="flex w-max flex-col items-center justify-center gap-2 border border-black bg-white p-4">
                        {userState === 'login' ? (
                            <>
                                <GlobalLoginComponent
                                    onSubmit={({ status, message }) => {
                                        // if (status === 'success') {
                                        //     handleEmail(watchOfframp())
                                        // } else {
                                        //     setErrorState({
                                        //         showError: true,
                                        //         errorMessage: message,
                                        //     })
                                        // }
                                    }}
                                />
                                <span className="text-h8 font-normal">
                                    Click{' '}
                                    <span
                                        className="cursor-pointer underline"
                                        onClick={() => {
                                            setUserState('register')
                                        }}
                                    >
                                        here
                                    </span>{' '}
                                    to register
                                </span>
                            </>
                        ) : (
                            <>
                                <GlobalRegisterComponent />
                                <span className="text-h8 font-normal">
                                    Click{' '}
                                    <span
                                        className="cursor-pointer underline"
                                        onClick={() => {
                                            setUserState('login')
                                        }}
                                    >
                                        here
                                    </span>{' '}
                                    to login
                                </span>
                            </>
                        )}
                        <span className="flex w-full flex-row items-center justify-center gap-2">
                            <p>Or</p>
                        </span>
                        <button
                            onClick={() => {
                                if (address) {
                                    onClick()
                                } else {
                                    signInModal.open()
                                }
                            }}
                            className="z-20 w-max border border-black bg-white px-4 py-2 text-h6 text-black"
                        >
                            {address ? (
                                <span className="flex flex-row items-center justify-center gap-2 text-h6  text-black">
                                    <img src={assets.ETHEREUM_ICON.src} className="h-6 w-6" />
                                    Sign in with ethereum
                                    {isLoading && <Loading />}
                                </span>
                            ) : (
                                'Connect Wallet'
                            )}
                            {errorState.showError && (
                                <div className="text-start">
                                    <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                                </div>
                            )}
                        </button>{' '}
                    </div>
                </div>
            )}
        </div>
    )
}
