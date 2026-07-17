'use client'
import PEANUT_LOGO from '@/assets/logos/peanut-logo.svg'
import DirectSendQr from '@/components/Global/DirectSendQR'
import { Icon, type IconName, Icon as NavIcon } from '@/components/Global/Icons/Icon'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { useModalsContext } from '@/context/ModalsContext'
import { useUserStore } from '@/redux/hooks'
import classNames from 'classnames'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useHaptic } from 'use-haptic'

type NavPathProps = {
    labelKey: 'send' | 'request' | 'add' | 'withdraw' | 'history' | 'docs' | 'support'
    href: string
    icon: IconName
    size?: number
}

// todo: update icons based on new the design
const desktopPaths: NavPathProps[] = [
    { labelKey: 'send', href: '/send', icon: 'arrow-up-right', size: 14 },
    { labelKey: 'request', href: '/request', icon: 'arrow-down-left', size: 14 },
    { labelKey: 'add', href: '/add-money', icon: 'arrow-down', size: 15 },
    { labelKey: 'withdraw', href: '/withdraw', icon: 'arrow-up', size: 15 },
    { labelKey: 'history', href: '/history', icon: 'history', size: 15 },
    { labelKey: 'docs', href: '/en/help', icon: 'docs', size: 14 },
    { labelKey: 'support', href: '/support', icon: 'peanut-support', size: 14 },
]

type NavSectionProps = {
    paths: NavPathProps[]
    pathName: string
}

const NavSection: React.FC<NavSectionProps> = ({ paths, pathName }) => {
    const t = useTranslations('navigation')
    const router = useRouter()
    return (
        <>
            {paths.map(({ labelKey, href, icon, size }, index) => (
                <div key={`${labelKey}-${index}`}>
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
                                router.refresh()
                            }
                        }}
                    >
                        <Icon name={icon} className="block text-white" size={size} />
                        <span className="block w-fit pt-0.5 text-center text-base font-semibold">{t(labelKey)}</span>
                    </Link>
                    {index === 4 && <div className="w-full border-b border-grey-1 pt-5" />}
                </div>
            ))}
        </>
    )
}

type MobileNavProps = {
    pathName: string
}

const MobileNav: React.FC<MobileNavProps> = ({ pathName }) => {
    const t = useTranslations('navigation')
    const { setIsSupportModalOpen } = useModalsContext()
    const { triggerHaptic } = useHaptic()

    return (
        <div className="z-1 grid h-20 grid-cols-3 border-t border-black bg-background md:hidden">
            {/* Home Link */}
            <Link
                onClick={() => triggerHaptic()}
                href="/home"
                translate="no"
                className={classNames(
                    'notranslate flex flex-col items-center justify-center object-contain hover:cursor-pointer',
                    { 'text-primary-1': pathName === '/home' }
                )}
            >
                <NavIcon name="home" size={24} />
                <span className="mx-auto block text-center text-xs font-medium">{t('home')}</span>
            </Link>

            {/* QR Button - Main Action */}
            <DirectSendQr
                className="-translate-y-1/3 transform"
                disabled={underMaintenanceConfig.enableFullMaintenance}
            />

            {/* Support Link */}
            <button
                onClick={() => {
                    triggerHaptic()
                    setIsSupportModalOpen(true)
                }}
                translate="no"
                className={classNames(
                    'notranslate flex flex-col items-center justify-center object-contain hover:cursor-pointer',
                    { 'text-primary-1': pathName === '/support' }
                )}
            >
                <NavIcon name="peanut-support" size={24} />
                <span className="mx-auto mt-1 block pl-1 text-center text-xs font-medium">{t('support')}</span>
            </button>
        </div>
    )
}

const WalletNavigation: React.FC = () => {
    const t = useTranslations('navigation')
    const pathName = usePathname()
    const { user } = useUserStore()
    const isLoggedIn = !!user?.user.userId || false

    return (
        <div>
            <div className="hidden h-screen w-64 space-y-10 bg-black px-8 py-6 text-white md:block">
                <Link href="/home" className="hover:cursor-pointer">
                    <Image src={PEANUT_LOGO} alt={t('peanutLogoAlt')} className="w-28" />
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
