'use client'
import { STORE_NAME, MIGRATION_SURFACES } from '@/constants/migration.consts'
import { onStoreAnchorClick, storeAnchorHref } from '@/utils/migration.utils'
export function FooterStoreLinks() {
    return (
        <div className="mt-6 flex gap-6 text-body-s text-white">
            {(['ios', 'android'] as const).map((store) => (
                <a
                    onClick={() => onStoreAnchorClick(store, MIGRATION_SURFACES.LANDING_FOOTER)}
                    key={store}
                    className="underline"
                    href={storeAnchorHref(store)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {STORE_NAME[store]}
                </a>
            ))}
        </div>
    )
}
