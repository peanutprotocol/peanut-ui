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
        // Only set user data if we have a username
        if (!userData.username || typeof window === 'undefined') return

        // Wait for Crisp to be fully loaded
        const setData = () => {
            if (window.$crisp) {
                setCrispUserData(window.$crisp, userData)
            }
        }

        // Try to set immediately
        setData()

        // Also listen for Crisp session loaded event
        if (window.$crisp) {
            window.$crisp.push(['on', 'session:loaded', setData])
        }

        // Fallback: try again after a delay
        const timer = setTimeout(setData, 2000)

        return () => {
            clearTimeout(timer)
            if (window.$crisp) {
                window.$crisp.push(['off', 'session:loaded', setData])
            }
        }
    }, [userData])

    // Note: Crisp Chat does not offer version-pinned CDN URLs. The l.js loader
    // is designed to auto-update for security patches and feature updates.
    // This is a deliberate design choice by Crisp to ensure all clients receive
    // critical updates.
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
