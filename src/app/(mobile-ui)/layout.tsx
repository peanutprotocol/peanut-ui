import MobileLayoutClient from './MobileLayoutClient'
import '../../styles/globals.css'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
    return <MobileLayoutClient>{children}</MobileLayoutClient>
}
