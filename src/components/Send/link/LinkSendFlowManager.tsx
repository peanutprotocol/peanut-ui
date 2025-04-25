'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, SQUID_API_URL, SQUID_INTEGRATOR_ID } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { fetchWithSentry } from '@/utils'
import { useContext, useEffect } from 'react'
import NavHeader from '../../Global/NavHeader'
import LinkSendConfirmView from './views/Confirm.link.send.view'
import LinkSendInitialView from './views/Initial.link.send.view'
import LinkSendSuccessView from './views/Success.link.send.view'

interface LinkSendFlowManagerProps {
    onPrev?: () => void
}

const LinkSendFlowManager = ({ onPrev }: LinkSendFlowManagerProps) => {
    const dispatch = useAppDispatch()
    const { view } = useSendFlowStore()
    const { isPeanutWallet } = useWallet()
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

        dispatch(sendFlowActions.setCrossChainDetails(data.chains))
    }

    useEffect(() => {
        resetTokenContextProvider()
        fetchAndSetCrossChainDetails()
    }, [])

    useEffect(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [isPeanutWallet])

    // reset send flow state when component mounts
    useEffect(() => {
        dispatch(sendFlowActions.resetSendFlow())
    }, [dispatch])

    return (
        <div>
            {view === 'INITIAL' && (
                <div className="space-y-8">
                    <NavHeader onPrev={onPrev} title="Send" />
                    <LinkSendInitialView />
                </div>
            )}
            {view === 'CONFIRM' && <LinkSendConfirmView />}
            {view === 'SUCCESS' && <LinkSendSuccessView />}
        </div>
    )
}

export default LinkSendFlowManager
