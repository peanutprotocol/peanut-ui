export type ScreenId = 'welcome' | 'passkey' | 'add-wallets' | "contact-info" | 'success'

export type ScreenProps = {
    welcome: undefined
    passkey: {
        handle: string
    }
    'add-wallets': undefined
    success: undefined
    'contact-info': undefined
}

export type Step = {
    screenId: ScreenId
    title: string
    description?: string
    containerClassname: HTMLDivElement['className']
    component: () => JSX.Element
    centerComponent: () => JSX.Element
}