import React from 'react'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

import * as createLinkViews from './Link'
import * as batchCreateLinkViews from './Batch'
import * as raffleCreateLinkViews from './Raffle'

export type CreateType = 'normal' | 'raffle' | 'batch'

export type CreateScreens = 'INITIAL' | 'CONFIRM' | 'SUCCESS'

export type CreateScreensLegacy = 'INITIAL' | 'SUCCESS'
export interface INavigationProps {
    type: 'normal' | 'legacy'
}
export interface ICreateScreenState {
    screen: CreateScreens
    idx: number
}

export interface ICreateScreenStateLegacy {
    screen: CreateScreensLegacy
    idx: number
}

export const INIT_VIEW_STATE: ICreateScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const INIT_VIEW_STATE_LEGACY: ICreateScreenStateLegacy = {
    screen: 'INITIAL',
    idx: 0,
}

export interface ICreateScreenProps {
    onPrev: (type: 'normal' | 'legacy') => void
    onNext: (type: 'normal' | 'legacy') => void
    onCustom: (screen: CreateScreens) => void
    tokenValue: string | undefined
    setTokenValue: (value: string | undefined) => void
    linkDetails: peanutInterfaces.IPeanutLinkDetails
    setLinkDetails: (value: peanutInterfaces.IPeanutLinkDetails) => void
    password: string
    setPassword: (value: string) => void
    transactionType: 'normal' | 'gasless'
    setTransactionType: (value: 'normal' | 'gasless') => void
    gaslessPayload: peanutInterfaces.IGaslessDepositPayload | undefined
    setGaslessPayload: (value: peanutInterfaces.IGaslessDepositPayload | undefined) => void
    gaslessPayloadMessage: peanutInterfaces.IPreparedEIP712Message | undefined
    setGaslessPayloadMessage: (value: peanutInterfaces.IPreparedEIP712Message | undefined) => void
    preparedDepositTxs: peanutInterfaces.IPrepareDepositTxsResponse | undefined
    setPreparedDepositTxs: (value: peanutInterfaces.IPrepareDepositTxsResponse | undefined) => void
    txHash: string
    setTxHash: (value: string) => void
    link: string
    setLink: (value: string) => void
}

export const CREATE_SCREEN_FLOW: CreateScreens[] = ['INITIAL', 'CONFIRM', 'SUCCESS']

export const CREATE_SCREEN_MAP: { [key in CreateScreens]: { comp: React.FC<any> } } = {
    INITIAL: { comp: createLinkViews.CreateLinkInitialView },
    CONFIRM: { comp: createLinkViews.CreateLinkConfirmView },
    SUCCESS: { comp: createLinkViews.CreateLinkSuccessView },
}

export const CREATE_SCREEN_LEGACY_FLOW: CreateScreensLegacy[] = ['INITIAL', 'SUCCESS']

export const BATCH_CREATE_SCREEN_MAP: { [key in CreateScreensLegacy]: { comp: React.FC<any> } } = {
    INITIAL: { comp: batchCreateLinkViews.BatchCreateLinkInitialView },
    SUCCESS: { comp: batchCreateLinkViews.BatchCreateLinkSuccessView },
}

export const RAFFLE_CREATE_SCREEN_MAP: { [key in CreateScreensLegacy]: { comp: React.FC<any> } } = {
    INITIAL: { comp: raffleCreateLinkViews.RaffleCreateLinkInitialView },
    SUCCESS: { comp: raffleCreateLinkViews.RaffleCreateLinkSuccessView },
}
