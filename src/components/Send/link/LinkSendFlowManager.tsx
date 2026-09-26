'use client'

import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { LinkSendFlowProvider, useLinkSendFlow } from '@/context/LinkSendFlowContext'
import { useContext, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import NavHeader from '../../Global/NavHeader'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import LinkSendInitialView from './views/Initial.link.send.view'
import LinkSendSuccessView from './views/Success.link.send.view'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'

interface LinkSendFlowManagerProps {
    onPrev?: () => void
}

// inner component that uses the context
const LinkSendFlowContent = ({ onPrev }: LinkSendFlowManagerProps) => {
    const tNav = useTranslations('navigation')
    const { view } = useLinkSendFlow()
    const { resetTokenContextProvider, setSelectedChainID, setSelectedTokenAddress } = useContext(tokenSelectorContext)

    useEffect(() => {
        resetTokenContextProvider()
    }, [])

    // TODO: is this needed? after removing external wallets and token selector
    // rework
    useEffect(() => {
        setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
        setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
    }, [setSelectedChainID, setSelectedTokenAddress])

    return (
        <>
            {view === 'INITIAL' && (
                <PageStack>
                    <NavHeader onPrev={onPrev} title={tNav('send')} />
                    <PageStack.Center className="gap-4 md:my-0">
                        <LinkSendInitialView />
                    </PageStack.Center>
                </PageStack>
            )}
            {view === 'SUCCESS' && <LinkSendSuccessView />}
        </>
    )
}

// wrapper component that provides the context
const LinkSendFlowManager = ({ onPrev }: LinkSendFlowManagerProps) => {
    return (
        <LinkSendFlowProvider>
            <LinkSendFlowContent onPrev={onPrev} />
        </LinkSendFlowProvider>
    )
}

export default LinkSendFlowManager
