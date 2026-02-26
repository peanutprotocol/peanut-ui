import Script from 'next/script'
import { CRISP_WEBSITE_ID } from '@/constants/crisp'

export default function HelpLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Script id="crisp-widget" strategy="lazyOnload">
                {`window.$crisp=[];window.CRISP_WEBSITE_ID="${CRISP_WEBSITE_ID}";(function(){var d=document;var s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`}
            </Script>
        </>
    )
}
