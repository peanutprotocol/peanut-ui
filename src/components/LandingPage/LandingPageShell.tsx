import { FooterVisibilityObserver } from '@/components/Global/FooterVisibilityObserver'

export function LandingPageShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="enable-select !m-0 w-full !p-0">
            {children}
            <FooterVisibilityObserver />
        </div>
    )
}
