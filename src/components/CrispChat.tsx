'use client'

import Script from 'next/script'
import { useSupportModalContext } from '@/context/SupportModalContext'
import { useCrispUserData } from '@/hooks/useCrispUserData'
import { useCrispInitialization } from '@/hooks/useCrispInitialization'

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

    // Initialize Crisp user data using the centralized hook
    // typeof window check ensures SSR safety
    useCrispInitialization(
        typeof window !== 'undefined' ? window.$crisp : null,
        userData,
        undefined,
        !!userData.userId && typeof window !== 'undefined'
    )

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
