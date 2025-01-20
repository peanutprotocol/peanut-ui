import { PEANUT_LOGO } from '@/assets'
import { NavIcons, NavIconsName } from '@/components/0_Bruddle'
import classNames from 'classnames'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavPathProps = {
    name: string
    href: string
    icon: NavIconsName
}

type DesktopPaths = {
    [key: string]: NavPathProps[]
}

const mobilePaths: NavPathProps[] = [
    { name: 'Home', href: '/home', icon: 'home' },
    { name: 'History', href: '/history', icon: 'history' },
    { name: 'Support', href: '/support', icon: 'support' },
]

const desktopPaths: DesktopPaths = {
    'Money Transfer': [
        { name: 'Send', href: '/send', icon: 'send' },
        { name: 'Request', href: '/request/create', icon: 'request' },
        { name: 'Cashout', href: '/cashout', icon: 'cashout' },
        { name: 'History', href: '/history', icon: 'history' },
    ],
    Others: [
        { name: 'Docs', href: 'https://docs.peanut.to/', icon: 'docs' },
        { name: 'Support', href: '/support', icon: 'support' },
    ],
}

type NavSectionProps = {
    title: string
    tabs: NavPathProps[]
    pathName: string
    isLastSection?: boolean
}

const NavSection: React.FC<NavSectionProps> = ({ title, tabs, pathName, isLastSection }) => (
    <>
        {title && <div className="text-gray-2">{title}</div>}
        {tabs.map(({ name, href, icon }) => (
            <Link
                href={href}
                key={name}
                className={classNames('flex items-center gap-3 hover:cursor-pointer hover:text-white/80', {
                    'text-primary-1': pathName === href,
                })}
            >
                <NavIcons name={icon} className="block h-4 w-4" />
                <span className="block w-fit pt-0.5 text-center text-base font-semibold">{name}</span>
            </Link>
        ))}
        {!isLastSection && <div className="border-grey-1 w-full border-b" />}
    </>
)

type MobileNavProps = {
    tabs: NavPathProps[]
    pathName: string
}

const MobileNav: React.FC<MobileNavProps> = ({ tabs, pathName }) => (
    <div className="z-1 grid grid-cols-3 border-t border-black p-2 md:hidden">
        {tabs.map(({ name, href, icon }) => (
            <Link
                href={href}
                key={name}
                className={classNames(
                    'flex flex-col items-center justify-center object-contain py-2 hover:cursor-pointer',
                    { 'text-primary-1': pathName === href }
                )}
            >
                <NavIcons name={icon} size={24} className="h-7 w-7" />
                <span className="mx-auto mt-1 block pl-1 text-center text-xs font-medium">{name}</span>
            </Link>
        ))}
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
                    <NavSection title="Money Transfer" tabs={desktopPaths['Money Transfer']} pathName={pathName} />
                    <NavSection title="Others" tabs={desktopPaths['Others']} pathName={pathName} isLastSection />
                </div>
            </div>
            <MobileNav tabs={mobilePaths} pathName={pathName} />
        </div>
    )
}

export default WalletNavigation
