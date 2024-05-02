import { LoadingStateContextProvider } from './loadingStates.context'
import { TokenContextProvider } from './tokenSelector.context'

export const ContextProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <TokenContextProvider>
            <LoadingStateContextProvider>{children}</LoadingStateContextProvider>
        </TokenContextProvider>
    )
}
