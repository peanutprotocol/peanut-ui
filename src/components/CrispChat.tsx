'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { useSupportModalContext } from '@/context/SupportModalContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { setCrispUserData } from '@/utils/crisp'

export const CrispButton = ({ children, ...rest }: React.HTMLAttributes<HTMLButtonElement>) => {
    const { setIsSupportModalOpen } = useSupportModalContext()

    const handleClick = () => {
        setIsSupportModalOpen(true)
    }

    return (
        <button {...rest} onClick={handleClick}>
            {children}
        </button>
    )
}

export default function CrispChat() {
    const userData = useCrispUserData()

    useEffect(() => {
        if (!userData.userId || typeof window === 'undefined') return

        const setData = () => {
            if (window.$crisp) {
                setCrispUserData(window.$crisp, userData)
            }
        }

        // Set data immediately if Crisp is already loaded
        if (window.$crisp) {
            setData()
        }

        // Listen for session loaded event - primary event Crisp fires when ready
        // This ensures data persists across sessions and is set when Crisp initializes
        if (window.$crisp) {
            window.$crisp.push(['on', 'session:loaded', setData])
        }

        // Fallback: try once after a delay to catch cases where Crisp loads quickly
        const fallbackTimer = setTimeout(setData, 1000)

        return () => {
            clearTimeout(fallbackTimer)
            if (window.$crisp) {
                window.$crisp.push(['off', 'session:loaded', setData])
            }
        }
    }, [userData])

    // thought: we need to version pin this script
    return (
        <Script strategy="afterInteractive">
            {`
        window.$crisp=[];
        window.CRISP_WEBSITE_ID="916078be-a6af-4696-82cb-bc08d43d9125";
        (function(){
          d=document;
          s=d.createElement("script");
          s.src="https://client.crisp.chat/l.js";
          s.async=1;
          d.getElementsByTagName("head")[0].appendChild(s);
        })();
        window.$crisp.push(["safe", true]);
      `}
        </Script>
    )
}
