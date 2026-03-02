import Image from 'next/image'
import Link from 'next/link'
import { PEANUT_LOGO_BLACK } from '@/assets'

export function MarketingNav() {
    return (
        <nav className="flex items-center justify-between border-b border-n-1 bg-white px-4 py-3 md:px-8">
            <Link href="/">
                <Image src={PEANUT_LOGO_BLACK} alt="Peanut" width={110} height={40} />
            </Link>
            <Link
                href="/home"
                className="btn btn-purple btn-shadow-primary-4 active:translate-x-[3px] active:translate-y-[4px] active:shadow-none"
            >
                Get Started
            </Link>
        </nav>
    )
}
