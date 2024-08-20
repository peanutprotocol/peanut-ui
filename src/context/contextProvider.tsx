import { AuthProvider } from './authContext'
import { LoadingStateContextProvider } from './loadingStates.context'
import { TokenContextProvider } from './tokenSelector.context'

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <AuthProvider>
            <TokenContextProvider>
                <LoadingStateContextProvider>{children}</LoadingStateContextProvider>
            </TokenContextProvider>
        </AuthProvider>
    )
}
