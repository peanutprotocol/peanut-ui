'use client'

import PeanutMascot from './index'
import { twMerge } from '@/utils/tw'

// 'waving' is the bare waving Peanut. Konrad, 2026-11-20: no megaphone on the
// 'Get money alerts' prompt for now; that prompt's art is being decided separately.
export type PeanutMascotSceneName = 'waving'

/** Reusable mascot scenes. */
export const PeanutMascotScene = ({ scene, className }: { scene: PeanutMascotSceneName; className?: string }) => (
    <div
        className={twMerge('relative h-52 w-full max-w-64 overflow-visible', className)}
        aria-hidden="true"
        data-mascot-scene={scene}
    >
        {scene === 'waving' && (
            <PeanutMascot pose="waving-hello" className="absolute bottom-0 left-1/2 h-40 w-auto -translate-x-1/2" />
        )}
    </div>
)
