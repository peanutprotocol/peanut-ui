type ModalCopy = {
    kind: 'browser' | 'passkey'
    titleKey: 'unsupportedBrowserModal.title' | 'unsupportedBrowserModal.passkeyTitle'
    descriptionKey: 'unsupportedBrowserModal.description' | 'unsupportedBrowserModal.passkeyDescription'
}

type CompatibilityState = {
    showBrowserWarning: boolean
    passkeySupported: boolean
    passkeyLoading: boolean
}

const browserWarningCopy: ModalCopy = {
    kind: 'browser',
    titleKey: 'unsupportedBrowserModal.title',
    descriptionKey: 'unsupportedBrowserModal.description',
}

export const getCompatibilityModalCopy = ({
    showBrowserWarning,
    passkeySupported,
    passkeyLoading,
}: CompatibilityState): ModalCopy | null => {
    if (showBrowserWarning) return browserWarningCopy
    if (passkeyLoading || passkeySupported) return null

    return {
        kind: 'passkey',
        titleKey: 'unsupportedBrowserModal.passkeyTitle',
        descriptionKey: 'unsupportedBrowserModal.passkeyDescription',
    }
}
