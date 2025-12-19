'use client'

/**
 * context for send link flow state management
 *
 * send links let users create claimable payment links that can be:
 * - shared via any messaging app
 * - claimed by anyone with the link
 * - cross-chain claimable
 *
 * this context manages state for creating these links
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

// view states for link send flow
export type LinkSendFlowView = 'INITIAL' | 'SUCCESS'

// attachment options for link (matches IAttachmentOptions from shared types)
export interface LinkSendAttachmentOptions {
    fileUrl: string | undefined
    message: string | undefined
    rawFile: File | undefined
}

// error state
export interface LinkSendErrorState {
    showError: boolean
    errorMessage: string
}

// context type
interface LinkSendFlowContextType {
    // state
    view: LinkSendFlowView
    setView: (view: LinkSendFlowView) => void
    tokenValue: string | undefined
    setTokenValue: (value: string | undefined) => void
    link: string | undefined
    setLink: (link: string | undefined) => void
    attachmentOptions: LinkSendAttachmentOptions
    setAttachmentOptions: (options: LinkSendAttachmentOptions) => void
    errorState: LinkSendErrorState | undefined
    setErrorState: (state: LinkSendErrorState | undefined) => void
    crossChainDetails: peanutInterfaces.ISquidChain[] | undefined
    setCrossChainDetails: (details: peanutInterfaces.ISquidChain[] | undefined) => void

    // actions
    resetLinkSendFlow: () => void
}

const LinkSendFlowContext = createContext<LinkSendFlowContextType | undefined>(undefined)

interface LinkSendFlowProviderProps {
    children: ReactNode
}

export const LinkSendFlowProvider: React.FC<LinkSendFlowProviderProps> = ({ children }) => {
    const [view, setView] = useState<LinkSendFlowView>('INITIAL')
    const [tokenValue, setTokenValue] = useState<string | undefined>(undefined)
    const [link, setLink] = useState<string | undefined>(undefined)
    const [attachmentOptions, setAttachmentOptions] = useState<LinkSendAttachmentOptions>({
        fileUrl: undefined,
        message: undefined,
        rawFile: undefined,
    })
    const [errorState, setErrorState] = useState<LinkSendErrorState | undefined>(undefined)
    const [crossChainDetails, setCrossChainDetails] = useState<peanutInterfaces.ISquidChain[] | undefined>(undefined)

    const resetLinkSendFlow = useCallback(() => {
        setView('INITIAL')
        setTokenValue(undefined)
        setLink(undefined)
        setAttachmentOptions({
            fileUrl: undefined,
            message: undefined,
            rawFile: undefined,
        })
        setErrorState(undefined)
    }, [])

    const value = useMemo(
        () => ({
            view,
            setView,
            tokenValue,
            setTokenValue,
            link,
            setLink,
            attachmentOptions,
            setAttachmentOptions,
            errorState,
            setErrorState,
            crossChainDetails,
            setCrossChainDetails,
            resetLinkSendFlow,
        }),
        [view, tokenValue, link, attachmentOptions, errorState, crossChainDetails, resetLinkSendFlow]
    )

    return <LinkSendFlowContext.Provider value={value}>{children}</LinkSendFlowContext.Provider>
}

export const useLinkSendFlow = (): LinkSendFlowContextType => {
    const context = useContext(LinkSendFlowContext)
    if (context === undefined) {
        throw new Error('useLinkSendFlow must be used within LinkSendFlowProvider')
    }
    return context
}
