import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// handles translation state during view transitions to prevent dom errors
export const useTranslationViewTransition = () => {
    const [isTransitioning, setIsTransitioning] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        // check if google translate is active on the page
        const isTranslated =
            document.documentElement.classList.contains('translated-ltr') ||
            document.documentElement.classList.contains('translated-rtl')

        if (isTranslated) {
            // show loading state while translation processes new content
            setIsTransitioning(true)

            // wait for translation service to finish
            const timer = setTimeout(() => {
                // trigger translation service to process new content
                const event = new Event('translate-view')
                window.dispatchEvent(event)

                setIsTransitioning(false)
            }, 500)

            return () => clearTimeout(timer)
        }
    }, [pathname])

    return isTransitioning
}
