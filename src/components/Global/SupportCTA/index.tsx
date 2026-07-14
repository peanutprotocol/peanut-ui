'use client'

import { useModalsContext } from '@/context/ModalsContext'

// Opens the in-app support drawer (Crisp). There is no /support page, so a
// Link there dead-ends (and bounces to home in the native static export).
const SupportCTA = () => {
    const { openSupportWithMessage } = useModalsContext()
    return (
        <div className="flex flex-col items-center justify-center">
            <button
                type="button"
                onClick={() => openSupportWithMessage('Need help with this transaction: ')}
                className="mt-2 cursor-pointer text-sm text-grey-1 underline underline-offset-2"
            >
                Need help with this transaction?
            </button>
        </div>
    )
}

export default SupportCTA
