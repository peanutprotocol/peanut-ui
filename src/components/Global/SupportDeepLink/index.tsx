'use client'

import { useModalsContext } from '@/context/ModalsContext'
import { parseAsString, useQueryStates } from 'nuqs'
import { useEffect } from 'react'

/**
 * Opens the support drawer for `/home?support=open`, the deep link a support
 * reply push carries. The param is cleared right after so a refresh or a back
 * navigation does not reopen the drawer. Renders nothing.
 */
const SupportDeepLink = () => {
    const { setIsSupportModalOpen } = useModalsContext()
    const [{ support }, setQuery] = useQueryStates({ support: parseAsString })

    useEffect(() => {
        if (support !== 'open') return
        setIsSupportModalOpen(true)
        setQuery({ support: null })
    }, [support, setIsSupportModalOpen, setQuery])

    return null
}

export default SupportDeepLink
