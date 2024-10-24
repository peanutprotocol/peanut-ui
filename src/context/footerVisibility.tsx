'use client'
import React, { createContext, useState, useContext, ReactNode } from 'react'

interface FooterVisibilityContextProps {
    isFooterVisible: boolean
    setIsFooterVisible: (visible: boolean) => void
}

const FooterVisibilityContext = createContext<FooterVisibilityContextProps | undefined>(undefined)

export const FooterVisibilityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isFooterVisible, setIsFooterVisible] = useState(false)

    return (
        <FooterVisibilityContext.Provider value={{ isFooterVisible, setIsFooterVisible }}>
            {children}
        </FooterVisibilityContext.Provider>
    )
}

export const useFooterVisibility = (): FooterVisibilityContextProps => {
    const context = useContext(FooterVisibilityContext)
    if (context === undefined) {
        throw new Error('useFooterVisibility must be used within a FooterVisibilityProvider')
    }
    return context
}
