import * as views from './Views'

export enum SetupViewsType {
    HANDLE = 'HANDLE',
    AUTH = 'AUTH',
    WALLETS = 'WALLETS',
    SUCCESS = 'SUCCESS'
} 

export interface ISetupViewState {
    screen: SetupViewsType
    idx: number
}

export const INIT_VIEW_STATE: ISetupViewState = {
    screen: SetupViewsType.HANDLE,
    idx: 0,
}

export const SETUP_VIEW_FLOW: SetupViewsType[] = [
    SetupViewsType.HANDLE,
    SetupViewsType.AUTH,
    SetupViewsType.WALLETS,
    SetupViewsType.SUCCESS,
]

export const SETUP_VIEW_MAP: { [key in SetupViewsType]: { comp: React.FC<any> } } = {
    HANDLE:     { comp: views.HandleSetupView },
    AUTH:       { comp: views.HandleSetupView },
    WALLETS:    { comp: views.HandleSetupView },
    SUCCESS:    { comp: views.HandleSetupView }
}