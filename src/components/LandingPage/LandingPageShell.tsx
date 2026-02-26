import type { ReactNode } from 'react'
import { FooterVisibilityObserver } from '@/components/Global/FooterVisibilityObserver'

export function LandingPageShell({ children }: { children: ReactNode }) {
    return (
        <div className="enable-select !m-0 w-full !p-0">
            {children}
            <FooterVisibilityObserver />
        </div>
    )
}
