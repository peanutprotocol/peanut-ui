/**
 * i18n overflow gate (TASK-22366): e2e/shots/overflow.spec.ts once per
 * supported non-English locale at 320px, plus the detector self-tests.
 * es-419 alone is not a safe maximum — hundreds of pt-BR strings run longer
 * than their es-419 counterparts, and es-AR overrides es-419 — so every
 * locale gets its own project. Everything else — server, timeouts,
 * determinism — comes from playwright.shots.config.ts. The check is absolute
 * (is text clipped?), not comparative, so there is no baseline and no width
 * matrix. The truncation projects run overflow-truncation.spec.ts: the screens
 * where no copy may be cut at all, at 375px in every app locale.
 *
 *   npm run test:i18n-overflow            # build, then check
 *   npm run test:i18n-overflow:run        # check again, no rebuild
 */

import { defineConfig } from '@playwright/test'
import base from './playwright.shots.config'

const LOCALES = ['es-419', 'pt-BR', 'es-AR'] as const

export default defineConfig({
    ...base,
    projects: [
        ...LOCALES.map((locale) => ({
            name: locale,
            testMatch: /overflow\.spec\.ts/,
            use: {
                ...base.use,
                viewport: { width: 320, height: 568 },
                locale,
            },
        })),
        ...(['en', ...LOCALES] as const).map((locale) => ({
            name: `truncation-${locale}`,
            testMatch: /overflow-truncation\.spec\.ts/,
            use: {
                ...base.use,
                viewport: { width: 375, height: 667 },
                locale,
            },
        })),
        // synthetic self-tests for the detector itself (overflow-check.ts)
        {
            name: 'detector',
            testMatch: /overflow-detector\.spec\.ts/,
            use: {
                ...base.use,
                viewport: { width: 320, height: 568 },
            },
        },
    ],
})
