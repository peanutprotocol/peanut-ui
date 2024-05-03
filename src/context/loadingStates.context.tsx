'use client'
import React, { createContext, useContext, useMemo, useState } from 'react'

import * as consts from '@/constants'
export const loadingStateContext = createContext({
    loadingState: '' as consts.LoadingStates,
    setLoadingState: (state: consts.LoadingStates) => {},
    isLoading: false as boolean,
})

export const LoadingStateContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [loadingState, setLoadingState] = useState<consts.LoadingStates>('idle')
    const isLoading = useMemo(() => loadingState !== 'idle', [loadingState])

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
