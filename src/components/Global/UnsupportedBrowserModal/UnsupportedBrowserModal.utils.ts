import { BrowserType } from '@/hooks/useGetBrowserType'

type ModalCopy = {
    titleKey: 'unsupportedBrowserModal.title' | 'unsupportedBrowserModal.passkeyTitle'
    descriptionKey:
        | 'unsupportedBrowserModal.description'
        | 'unsupportedBrowserModal.passkeyDescription'
        | 'unsupportedBrowserModal.passkeyDescriptionInChrome'
        | 'unsupportedBrowserModal.passkeyDescriptionInSafari'
}

type CompatibilityState = {
    showBrowserWarning: boolean
    passkeySupported: boolean
    passkeyLoading: boolean
    browserType: BrowserType | null
    browserTypeLoading: boolean
}

const browserWarningCopy: ModalCopy = {
    titleKey: 'unsupportedBrowserModal.title',
    descriptionKey: 'unsupportedBrowserModal.description',
}

const passkeyDescriptionKey = (browserType: BrowserType | null): ModalCopy['descriptionKey'] => {
    if (browserType === BrowserType.CHROME) return 'unsupportedBrowserModal.passkeyDescriptionInChrome'
    if (browserType === BrowserType.SAFARI) return 'unsupportedBrowserModal.passkeyDescriptionInSafari'
    return 'unsupportedBrowserModal.passkeyDescription'
}

export const getCompatibilityModalCopy = ({
    showBrowserWarning,
    passkeySupported,
    passkeyLoading,
    browserType,
    browserTypeLoading,
}: CompatibilityState): ModalCopy | null => {
    if (showBrowserWarning) return browserWarningCopy
    if (passkeyLoading || browserTypeLoading || passkeySupported) return null

    return {
        titleKey: 'unsupportedBrowserModal.passkeyTitle',
        descriptionKey: passkeyDescriptionKey(browserType),
    }
}
