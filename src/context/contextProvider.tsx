import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { AuthProvider } from './authContext'
import { LoadingStateContextProvider } from './loadingStates.context'
import { PushProvider } from './pushProvider'
import { TokenContextProvider } from './tokenSelector.context'

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <ToastProvider>
            <AuthProvider>
                <PushProvider>
                    <TokenContextProvider>
                        <LoadingStateContextProvider>{children}</LoadingStateContextProvider>
                    </TokenContextProvider>
                </PushProvider>
            </AuthProvider>
        </ToastProvider>
    )
}
