'use client'

import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useAppHelpDrawer } from '@/components/Global/AppHelpProvider'
import { useModalsContext } from '@/context/ModalsContext'

/** Keep the article's localized support action available inside the app. */
export default function AppHelpSupportCTA({ text }: { text: string }) {
    const setActiveHelp = useAppHelpDrawer()
    const { setIsSupportModalOpen } = useModalsContext()

    return (
        <LinkButton
            className="mb-4"
            onClick={() => {
                setActiveHelp?.(null)
                setIsSupportModalOpen(true)
            }}
        >
            {text}
        </LinkButton>
    )
}
