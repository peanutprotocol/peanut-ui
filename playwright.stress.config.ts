/**
 * Stress gate (TASK-23132): e2e/shots/overflow-stress.spec.ts over every
 * fixture, with worst-case data (en, pt-BR) and with large system text
 * (150%, 200%), all at 320px. Server, timeouts and determinism come from
 * playwright.shots.config.ts. Kept out of playwright.overflow.config.ts so the
 * i18n gate's runtime and verdict do not change while this one is advisory.
 *
 *   npm run test:stress            # build, then check
 *   npm run test:stress:run        # check again, no rebuild
 */

import { defineConfig } from '@playwright/test'
import base from './playwright.shots.config'

const viewport = { width: 320, height: 568 }

export default defineConfig({
    ...base,
    projects: [
        ...(['en', 'pt-BR'] as const).map((locale) => ({
            name: `stress-${locale}`,
            testMatch: /overflow-stress\.spec\.ts/,
            metadata: { stress: true },
            use: { ...base.use, viewport, locale },
        })),
        ...(['150%', '200%'] as const).map((rootFontSize) => ({
            name: `large-text-${rootFontSize.replace('%', '')}`,
            testMatch: /overflow-stress\.spec\.ts/,
            metadata: { rootFontSize },
            use: { ...base.use, viewport, locale: 'en' },
        })),
    ],
})
