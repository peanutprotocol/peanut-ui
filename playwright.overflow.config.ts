/**
 * i18n overflow gate (TASK-22366): e2e/shots/overflow.spec.ts in es-419 at
 * 320px. Everything else — server, timeouts, determinism — comes from
 * playwright.shots.config.ts; only the locale and the project set differ.
 * The check is absolute (is text clipped?), not comparative, so there is no
 * baseline and no width matrix.
 *
 *   npm run test:i18n-overflow            # build, then check
 *   npm run test:i18n-overflow:run        # check again, no rebuild
 */

import { defineConfig } from '@playwright/test'
import base from './playwright.shots.config'

export default defineConfig({
    ...base,
    projects: [
        {
            name: 'overflow',
            testMatch: /overflow\.spec\.ts/,
            use: {
                ...base.use,
                viewport: { width: 320, height: 568 },
                locale: 'es-419',
            },
        },
    ],
})
