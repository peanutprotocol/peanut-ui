import * as views from './Views'

export type CreateScreens = 'INITIAL' | 'SUCCESS'
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

    SUCCESS: { comp: views.SuccessView },
}

export interface ICreateScreenProps {
    onNext: () => void
    onPrev: () => void
}
