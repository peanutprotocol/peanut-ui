import React, { createContext, useState } from 'react'

export const tokenSelectorContext = createContext({
    selectedTokenAddress: '',
    selectedChainID: '',
    setSelectedTokenAddress: (address: string) => {},
    setSelectedChainID: (chainID: string) => {},
})

export const TokenContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [selectedTokenAddress, setSelectedTokenAddress] = useState('0x0000000000000000000000000000000000000000')
    const [selectedChainID, setSelectedChainID] = useState('1')

    const updateSelectedChainID = (chainID: string) => {
        setSelectedTokenAddress('0x0000000000000000000000000000000000000000')
        setSelectedChainID(chainID)
    }

    return (
        <tokenSelectorContext.Provider
            value={{
                selectedTokenAddress,
                setSelectedTokenAddress,
                selectedChainID,
                setSelectedChainID: updateSelectedChainID,
            }}
        >
            {children}
        </tokenSelectorContext.Provider>
    )
}
