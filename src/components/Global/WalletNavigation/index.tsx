import { PEANUT_LOGO } from '@/assets'
import DirectSendQr from '@/components/Global/DirectSendQR'
import { Icon, IconName, Icon as NavIcon } from '@/components/Global/Icons/Icon'
import { useUserStore } from '@/redux/hooks'
import classNames from 'classnames'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavPathProps = {
    name: string
    href: string
    icon: IconName
    size?: number
}

// todo: update icons based on new the design
const desktopPaths: NavPathProps[] = [
    { name: 'Send', href: '/send', icon: 'arrow-up-right', size: 10 },
    { name: 'Request', href: '/request', icon: 'arrow-down-left', size: 10 },
    { name: 'Cashout', href: '/cashout', icon: 'arrow-down', size: 12 },
    { name: 'History', href: '/history', icon: 'history', size: 16 },
    { name: 'Docs', href: 'https://docs.peanut.to/', icon: 'docs', size: 16 },
    { name: 'Support', href: '/support', icon: 'peanut-support', size: 16 },
]

type NavSectionProps = {
    paths: NavPathProps[]
    pathName: string
}

const NavSection: React.FC<NavSectionProps> = ({ paths, pathName }) => (
    <>
        {paths.map(({ name, href, icon, size }, index) => (
            <div key={`${name}-${index}`}>
                <Link
                    href={href}
                    className={classNames(
                        'flex items-center gap-3 text-white hover:cursor-pointer hover:text-white/80',
                        {
                            'text-primary-1': pathName === href,
                        }
                    )}
                    onClick={() => {
                        if (pathName === href) {
                            window.location.reload()
                        }
                    }}
                >
                    <Icon name={icon} className="block text-white" size={size} />
                    <span className="block w-fit pt-0.5 text-center text-base font-semibold">{name}</span>
                </Link>
                {index === 3 && <div className="w-full border-b border-grey-1" />}
            </div>
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
    const { user } = useUserStore()
    const isLoggedIn = !!user?.user.userId || false

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
            {isLoggedIn && <MobileNav pathName={pathName} />}
        </div>
    )
}

export default WalletNavigation
