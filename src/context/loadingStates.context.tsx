'use client'
import React, { createContext, useContext, useMemo, useState } from 'react'

import * as consts from '@/constants'
export const loadingStateContext = createContext({
    loadingState: '' as consts.LoadingStates,
    setLoadingState: (state: consts.LoadingStates) => {},
    isLoading: false as boolean,
})

/**
 * Context provider to manage the application's loading state.
 * It tracks whether the app is in a loading state and provides a mechanism to update the state across the component tree.
 * Used for all loading states; e.g., fetching data, processing transactions, switching chains...
 */
export const LoadingStateContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [loadingState, setLoadingState] = useState<consts.LoadingStates>('Idle')
    const isLoading = useMemo(() => loadingState !== 'Idle', [loadingState])

    return (
        <loadingStateContext.Provider
            value={{
                loadingState,
                setLoadingState,
                isLoading,
            }}
        >
            {children}
        </loadingStateContext.Provider>
    )
}
