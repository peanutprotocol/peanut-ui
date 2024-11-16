export type ScreenId =
    | 'pwa-install'
    | 'welcome'
    | 'passkey'
    | 'contact-info'
    | 'success'
    | 'noficiation-permission'
    | 'add-wallets'

export type ScreenProps = {
    welcome: undefined
    passkey: {
        handle: string
    }
    'noficiation-permission': undefined
    'add-wallets': undefined
    success: undefined
    'contact-info': undefined
    'pwa-install': undefined
}

export type Step = {
    screenId: ScreenId
    active: boolean
    title: string
    description?: string
    containerClassname: HTMLDivElement['className']
    component: () => JSX.Element
    centerComponent: () => JSX.Element | null
}
