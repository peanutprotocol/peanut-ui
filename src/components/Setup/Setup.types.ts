export type ScreenId = 'pwa-install' | 'welcome' | 'passkey' | 'contact-info' | 'success'

export type ScreenProps = {
    welcome: undefined
    passkey: {
        handle: string
    }
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
