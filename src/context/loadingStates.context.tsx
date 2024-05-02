import React, { createContext, useContext, useState } from 'react'

import * as consts from '@/constants'
export const loadingStateContext = createContext({
    loadingstate: '' as consts.LoadingStates,
    setLoadingState: (state: consts.LoadingStates) => {},
})

export const LoadingStateContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [loadingstate, setLoadingState] = useState<consts.LoadingStates>('idle')

    return (
        <loadingStateContext.Provider
            value={{
                loadingstate,
                setLoadingState,
            }}
        >
            {children}
        </loadingStateContext.Provider>
    )
}
