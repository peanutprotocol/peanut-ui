'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'

export const CrispButton = ({ children, ...rest }: React.HTMLAttributes<HTMLButtonElement>) => {
    const router = useRouter()

    const handleClick = () => {
        if (window.$crisp) {
            window.$crisp.push(['do', 'chat:open'])
        } else {
            // Fallback to support page if Crisp isn't loaded
            router.push('/support')
        }
    }

    return (
        <button {...rest} onClick={handleClick}>
            {children}
        </button>
    )
}

export default function CrispChat() {
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
