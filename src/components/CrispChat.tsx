'use client'

import { useModalsContext } from '@/context/ModalsContext'

/**
 * Button component that opens the support drawer
 *
 * The support UI is rendered via SupportDrawer component (iframe proxy approach)
 * rather than the native Crisp widget to maintain better UX control and avoid
 * page layout interference.
 */
export const CrispButton = ({ children, ...rest }: React.HTMLAttributes<HTMLButtonElement>) => {
    const { setIsSupportModalOpen } = useModalsContext()

    const handleClick = () => {
        setIsSupportModalOpen(true)
    }

    return (
        <button {...rest} onClick={handleClick}>
            {children}
        </button>
    )
}
