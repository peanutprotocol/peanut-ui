import { PEANUT_LOGO } from '@/assets'
import { NavIconsName } from '@/components/0_Bruddle'
import DirectSendQr from '@/components/Global/DirectSendQR'
import Icon from '@/components/Global/Icon'
import { Icon as NavIcon } from '@/components/Global/Icons/Icon'
import classNames from 'classnames'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavPathProps = {
    name: string
    href: string
    icon: NavIconsName
}

// todo: update icons based on new the design
const desktopPaths: NavPathProps[] = [
    { name: 'Send', href: '/send', icon: 'send' },
    { name: 'Request', href: '/request', icon: 'request' },
    { name: 'Cashout', href: '/cashout', icon: 'cashout' },
    { name: 'History', href: '/history', icon: 'history' },

    { name: 'Docs', href: 'https://docs.peanut.to/', icon: 'docs' },
    { name: 'Support', href: '/support', icon: 'support' },
]

type NavSectionProps = {
    paths: NavPathProps[]
    pathName: string
}

const NavSection: React.FC<NavSectionProps> = ({ paths, pathName }) => (
    <>
        {paths.map(({ name, href, icon }) => (
            <Link
                href={href}
                key={name}
                className={classNames('flex items-center gap-3 hover:cursor-pointer hover:text-white/80', {
                    'text-primary-1': pathName === href,
                })}
                onClick={() => {
                    if (pathName === href) {
                        window.location.reload()
                    }
                }}
            >
                <Icon name={icon} className="block h-4 w-4" />
                <span className="block w-fit pt-0.5 text-center text-base font-semibold">{name}</span>
            </Link>
        ))}
    </>
)

type MobileNavProps = {
    pathName: string
}

const MobileNav: React.FC<MobileNavProps> = ({ pathName }) => (
    <div className="z-1 grid h-20 grid-cols-3 border-t border-black bg-background md:hidden">
        {/* Home Link */}
        <Link
            href="/home"
            translate="no"
            className={classNames(
                'notranslate mb-4 flex flex-col items-center justify-center object-contain hover:cursor-pointer',
                { 'text-primary-1': pathName === '/home' }
            )}
        >
            <NavIcon name="home" size={20} />
            <span className="mx-auto mt-1 block text-center text-xs font-medium">Home</span>
        </Link>

        {/* QR Button - Main Action */}
        <DirectSendQr className="-translate-y-1/3 transform" />

        {/* Support Link */}
        <Link
            href="/support"
            translate="no"
            className={classNames(
                'notranslate mb-4 flex flex-col items-center justify-center object-contain  hover:cursor-pointer',
                { 'text-primary-1': pathName === '/support' }
            )}
        >
            <NavIcon name="peanut-support" size={20} />
            <span className="mx-auto mt-1 block pl-1 text-center text-xs font-medium">Support</span>
        </Link>
    </div>
)

const WalletNavigation: React.FC = () => {
    const pathName = usePathname()

    return (
        <div>
            <div className="hidden h-screen w-64 space-y-10 bg-black px-8 py-6 text-white md:block">
                <Link href="/home" className="hover:cursor-pointer">
                    <Image src={PEANUT_LOGO} alt="Peanut Logo" className="w-28" />
                </Link>
                <div className="space-y-4">
                    <NavSection paths={desktopPaths} pathName={pathName} />
                </div>
            </div>
            <MobileNav pathName={pathName} />
        </div>
    )
}

export default WalletNavigation
