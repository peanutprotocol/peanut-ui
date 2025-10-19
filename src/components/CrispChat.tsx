'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { useSupportModalContext } from '@/context/SupportModalContext'
import { useAuth } from '@/context/authContext'

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
    const { username, userId } = useAuth()

    useEffect(() => {
        // Only set user data if we have a username
        if (!username || typeof window === 'undefined') return

        // Wait for Crisp to be fully loaded
        const setCrispUserData = () => {
            if (window.$crisp) {
                // Set user nickname
                window.$crisp.push(['set', 'user:nickname', [username]])
                window.$crisp.push(['set', 'user:email', [`${username}@peanut.to`]])

                // Build Grafana dashboard link
                const grafanaLink = `https://teampeanut.grafana.net/d/ad31f645-81ca-4779-bfb2-bff8e03d9057/explore-peanut-wallet-user?orgId=1&var-GRAFANA_VAR_Username=${encodeURIComponent(username)}`

                // Set session data according
                window.$crisp.push([
                    'set',
                    'session:data',
                    [
                        [
                            ['username', username],
                            ['user_id', userId || ''],
                            ['grafana_dashboard', grafanaLink],
                        ],
                    ],
                ])
            }
        }

        // Try to set immediately
        setCrispUserData()

        // Also listen for Crisp session loaded event
        if (window.$crisp) {
            window.$crisp.push(['on', 'session:loaded', setCrispUserData])
        }

        // Fallback: try again after a delay
        const timer = setTimeout(setCrispUserData, 2000)

        return () => {
            clearTimeout(timer)
            if (window.$crisp) {
                window.$crisp.push(['off', 'session:loaded', setCrispUserData])
            }
        }
    }, [username, userId])

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
