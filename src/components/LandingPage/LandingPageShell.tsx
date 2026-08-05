import type { ReactNode } from 'react'
import { FooterVisibilityObserver } from '@/components/Global/FooterVisibilityObserver'

export function LandingPageShell({ children }: { children: ReactNode }) {
    return (
        // overflow-x-clip: decorative absolutely-positioned elements (clouds,
        // stars) extend past the right edge and made the whole page scroll
        // horizontally on mobile. clip (not hidden) so no scroll container is
        // created and sticky/fixed children keep working.
        <div className="enable-select !m-0 w-full overflow-x-clip !p-0">
            {children}
            <FooterVisibilityObserver />
        </div>
    )
}
