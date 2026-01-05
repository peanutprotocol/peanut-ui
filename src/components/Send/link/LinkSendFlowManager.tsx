'use client'

import { tokenSelectorContext } from '@/context'
import { LinkSendFlowProvider, useLinkSendFlow } from '@/context/LinkSendFlowContext'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { useContext, useEffect } from 'react'
import NavHeader from '../../Global/NavHeader'
import LinkSendInitialView from './views/Initial.link.send.view'
import LinkSendSuccessView from './views/Success.link.send.view'
import { SQUID_INTEGRATOR_ID, SQUID_API_URL } from '@/constants/general.consts'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'

interface LinkSendFlowManagerProps {
    onPrev?: () => void
}

// inner component that uses the context
const LinkSendFlowContent = ({ onPrev }: LinkSendFlowManagerProps) => {
    const { view, setCrossChainDetails } = useLinkSendFlow()
    const { resetTokenContextProvider, setSelectedChainID, setSelectedTokenAddress } = useContext(tokenSelectorContext)

    const fetchAndSetCrossChainDetails = async () => {
        const response = await fetchWithSentry(`${SQUID_API_URL}/chains`, {
            headers: {
                'x-integrator-id': SQUID_INTEGRATOR_ID,
            },
        })
        if (!response.ok) {
            console.log('Squid: Network response was not ok:', response)
            throw new Error('Squid: Network response was not ok')
        }
        const data = await response.json()
        setCrossChainDetails(data.chains)
    }

    useEffect(() => {
        resetTokenContextProvider()
        fetchAndSetCrossChainDetails()
    }, [])

    // TODO: is this needed? after removing external wallets and token selector
    // rework
    useEffect(() => {
        setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
        setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
    }, [])

    return (
        <>
            {view === 'INITIAL' && (
                <div className="flex w-full flex-col justify-start space-y-8">
                    <NavHeader onPrev={onPrev} title="Send" />
                    <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                        <LinkSendInitialView />
                    </div>
                </div>
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
