import { IAttachmentOptions } from '@/components/Create/Create.consts'
import * as views from './Views'

type CreateScreens = 'INITIAL' | 'SUCCESS'
export interface ICreateScreenState {
    screen: CreateScreens
    idx: number
}

export const INIT_VIEW_STATE: ICreateScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const CREATE_SCREEN_FLOW: CreateScreens[] = ['INITIAL', 'SUCCESS']

export const CREATE_SCREEN_MAP: { [key in CreateScreens]: { comp: React.FC<any> } } = {
    INITIAL: { comp: views.InitialView },

    SUCCESS: { comp: views.CreateRequestSuccessView },
}

export interface ICreateScreenProps {
    onNext: () => void
    onPrev: () => void
    link: string
    setLink: (value: string) => void
    attachmentOptions: IAttachmentOptions
    setAttachmentOptions: (options: IAttachmentOptions) => void
    tokenValue: string | undefined
    setTokenValue: (value: string | undefined) => void
    usdValue: string | undefined
    setUsdValue: (value: string | undefined) => void
    recipientAddress: string
    setRecipientAddress: (value: string) => void
}
