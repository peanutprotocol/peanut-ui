'use client'

import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { fetchWithSentry } from '@/utils'
import { useContext, useEffect } from 'react'
import PageContainer from '../0_Bruddle/PageContainer'
import ConfirmSendView from './views/Confirm.send.view'
import InitialSendView from './views/Initial.send.view'
import SuccessSendView from './views/Success.send.view'

const SendFlowManager = () => {
    const dispatch = useAppDispatch()
    const { view } = useSendFlowStore()
    const { isPeanutWallet } = useWallet()
    const { resetTokenContextProvider, setSelectedChainID, setSelectedTokenAddress } = useContext(tokenSelectorContext)

    const fetchAndSetCrossChainDetails = async () => {
        const response = await fetchWithSentry('https://apiplus.squidrouter.com/v2/chains', {
            headers: {
                'x-integrator-id': '11CBA45B-5EE9-4331-B146-48CCD7ED4C7C',
            },
        })
        if (!response.ok) {
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

    return (
        <PageContainer>
            <div className="max-w-xl">
                {view === 'INITIAL' && <InitialSendView />}
                {view === 'CONFIRM' && <ConfirmSendView />}
                {view === 'SUCCESS' && <SuccessSendView />}
            </div>
        </PageContainer>
    )
}

export default SendFlowManager
