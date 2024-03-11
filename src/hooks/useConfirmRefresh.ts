import { useEffect } from 'react'

export const useConfirmRefresh = (enable: boolean) => {
    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = '' // This is required for Chrome
        }

        if (enable && typeof window !== 'undefined') {
            window.addEventListener('beforeunload', handleBeforeUnload)
        }

        return () => {
            if (enable && typeof window !== 'undefined') {
                window.removeEventListener('beforeunload', handleBeforeUnload)
            }
        }
    }, [enable])
}
