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
import { parseAsString, useQueryStates } from 'nuqs'

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
    // stable identifier for logic that must distinguish a specific error from
    // the rendered (localized) message — e.g. clearing only the balance-gate error
    errorCode?: string
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

    // actions
    resetLinkSendFlow: () => void
}

const LinkSendFlowContext = createContext<LinkSendFlowContextType | undefined>(undefined)

interface LinkSendFlowProviderProps {
    children: ReactNode
}

export const LinkSendFlowProvider: React.FC<LinkSendFlowProviderProps> = ({ children }) => {
    const [view, setViewState] = useState<LinkSendFlowView>('INITIAL')
    // the amount rides in the URL too, so a bank page or /verify opened to add money comes back to it
    // (TASK-25467). Never the message or the file: free text may hold personal data. The memory copy
    // keeps the amount on the success view after the URL drops it.
    const [{ amount }, setQuery] = useQueryStates({ amount: parseAsString })
    const [tokenValue, setTokenValueState] = useState<string | undefined>(amount ?? undefined)
    const setTokenValue = useCallback(
        (value: string | undefined) => {
            setTokenValueState(value)
            void setQuery({ amount: value || null })
        },
        [setQuery]
    )
    // a refresh after a created link must not open the form filled in again
    const setView = useCallback(
        (next: LinkSendFlowView) => {
            setViewState(next)
            if (next === 'SUCCESS') void setQuery({ amount: null })
        },
        [setQuery]
    )
    const [link, setLink] = useState<string | undefined>(undefined)
    const [attachmentOptions, setAttachmentOptions] = useState<LinkSendAttachmentOptions>({
        fileUrl: undefined,
        message: undefined,
        rawFile: undefined,
    })
    const [errorState, setErrorState] = useState<LinkSendErrorState | undefined>(undefined)

    // memory only: the URL dropped the amount at SUCCESS, and this runs as the user leaves the route
    const resetLinkSendFlow = useCallback(() => {
        setViewState('INITIAL')
        setTokenValueState(undefined)
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
            resetLinkSendFlow,
        }),
        [view, setView, tokenValue, setTokenValue, link, attachmentOptions, errorState, resetLinkSendFlow]
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
