import React from 'react'
import * as views from './sendViews'
import * as raffleViews from './raffleViews'

export interface ISendFormData {
    chainId: string
    token: string
    amount: string | null
    bulkAmount: number | undefined
    numberOfrecipients: string | undefined
    senderName: string | undefined
}

export interface ITokenListItem {
    symbol: string
    amount: number
    chainId: string
    address: string
    decimals: number
    logo: string
    name: string
}

export type SendScreens = 'INITIAL' | 'SUCCESS'
export interface ISendScreenState {
    screen: SendScreens
    idx: number
}

export interface ISendScreenProps {
    onNextScreen: () => void
    onCustomScreen: (screen: SendScreens) => void
    claimLink: string[]
    setClaimLink: (claimLink: string[]) => void
    txHash: string
    setTxHash: (txHash: string) => void
    chainId: string
    setChainId: (chainId: string) => void
    ensName: string
    setEnsName: (ensName: string) => void
}

export const INIT_VIEW: ISendScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const SEND_SCREEN_FLOW: SendScreens[] = ['INITIAL', 'SUCCESS']

export const SEND_SCREEN_MAP: { [key in SendScreens]: { comp: React.FC<any> } } = {
    INITIAL: { comp: views.SendInitialView },
    SUCCESS: { comp: views.SendSuccessView },
}

export const RAFFLE_SEND_SCREEN_MAP: {
    [key in SendScreens]: { comp: React.FC<any> }
} = {
    INITIAL: { comp: raffleViews.RaffleInitialView },
    SUCCESS: { comp: raffleViews.RaffleSuccessView },
}
