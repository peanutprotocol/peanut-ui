import * as views from './Components'

export type CashoutScreens = 'INITIAL' | 'CONFIRM' | 'SUCCESS'

export interface ICashoutScreenState {
    screen: CashoutScreens
    idx: number
}

export const INIT_VIEW_STATE: ICashoutScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const CASHOUT_SCREEN_FLOW: CashoutScreens[] = ['INITIAL', 'CONFIRM', 'SUCCESS']

export const CREATE_SCREEN_MAP: { [key in CashoutScreens]: { comp: React.FC<any> } } = {
    INITIAL: { comp: views.InitialCashoutView },
    CONFIRM: { comp: views.ConfirmCashoutView },
    SUCCESS: { comp: views.SuccessCashoutView },
}

export interface ICashoutScreenProps {
    onPrev: () => void
    onNext: () => void
    onCustom: (screen: CashoutScreens) => void
}
