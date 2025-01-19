import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { AuthProvider } from './authContext'
import { LoadingStateContextProvider } from './loadingStates.context'
import { PushProvider } from './pushProvider'
import { TokenContextProvider } from './tokenSelector.context'
import { KernelClientProvider } from './kernelClient.context'

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <ToastProvider>
            <AuthProvider>
                <PushProvider>
                    <KernelClientProvider>
                        <TokenContextProvider>
                            <LoadingStateContextProvider>{children}</LoadingStateContextProvider>
                        </TokenContextProvider>
                    </KernelClientProvider>
                </PushProvider>
            </AuthProvider>
        </ToastProvider>
    )
}
