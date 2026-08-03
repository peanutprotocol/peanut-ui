'use client'
import { Icon } from '@/components/Global/Icons/Icon'
import { STORE_NAME, STORE_URL, type MigrationSurface, type StoreKind } from '@/constants/migration.consts'
import { trackStoreClick } from '@/utils/migration.utils'

// the classic app-store badge pair (black pills with brand marks) used under
// download CTAs and QRs. english-only on purpose: real store badges are.
const BADGE_SUB: Record<StoreKind, string> = {
    ios: 'Download on the',
    android: 'GET IT ON',
}

export default function StoreBadges({ surface }: { surface: MigrationSurface }) {
    return (
        <div className="flex items-center justify-center gap-3">
            {(['ios', 'android'] as const).map((s) => (
                <a
                    key={s}
                    href={STORE_URL[s]}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackStoreClick(s, surface)}
                    className="flex items-center gap-2 rounded-sm border border-n-1 bg-black px-3 py-1.5 text-white"
                >
                    <Icon name={s === 'ios' ? 'apple-logo' : 'google-play'} size={20} className="text-white" />
                    <span className="flex flex-col text-left leading-tight">
                        <span className="text-[9px] uppercase tracking-wide opacity-80">{BADGE_SUB[s]}</span>
                        <span className="text-sm font-semibold">{STORE_NAME[s]}</span>
                    </span>
                </a>
            ))}
        </div>
    )
}
