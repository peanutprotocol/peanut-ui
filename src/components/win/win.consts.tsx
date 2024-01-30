import * as views from './views'

export type winState = 'LOADING' | 'WIN' | 'NOT_FOUND' | 'EMPTY' | 'SUCCESS'

export type Screens = 'INITIAL' | 'SUCCESS'

export interface IWinScreenState {
    screen: Screens
    idx: number
}

export interface IWinScreenProps {
    onNextScreen: () => void
    onCustomScreen: (screen: Screens) => void
    raffleLink: string
    setRaffleLink: (link: string) => void
    raffleDetails: any
    setRaffleDetails: (details: any) => void
}

export const INIT_VIEW: IWinScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const WIN_SCREEN_FLOW: Screens[] = ['INITIAL', 'SUCCESS']

export const WIN_SCREEN_MAP: {
    [key in Screens]: { comp: React.FC<any> }
} = {
    INITIAL: { comp: views.WinInitialView },
    SUCCESS: { comp: views.WinSuccesView },
}
