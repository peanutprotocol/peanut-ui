/**
 * Seed utilities for E2E tests.
 *
 * Calls the API's /dev/seed-scenario endpoint to create test data,
 * and provides helpers for authenticating as seeded users.
 */

import type { BrowserContext } from '@playwright/test'
import { API_BASE_URL, getHarnessSecret } from './env'

/**
 * Seed a test scenario via the API harness.
 *
 * Returns the scenario-specific data payload (links, users, tokens, etc).
 * Throws on non-2xx response.
 */
export async function seedScenario(scenario: string, label?: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/dev/seed-scenario`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-test-harness-secret': getHarnessSecret(),
        },
        body: JSON.stringify({ scenario, harnessLabel: label || 'playwright' }),
    })

    if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>')
        throw new Error(
            `seed-scenario "${scenario}" failed: ${res.status} — ${body}\n` +
                `Ensure API is running at ${API_BASE_URL} with ENABLE_TEST_ROUTES=true`
        )
    }

    const json = await res.json()
    return json.data
}

/**
 * Authenticate a browser context as a specific user by setting the JWT cookie.
 *
 * Use this when a test needs a different identity than the bootstrap user
 * (e.g. testing claim from the receiver's perspective).
 */
export async function authenticateAs(context: BrowserContext, token: string) {
    await context.addCookies([
        {
            name: 'jwt-token',
            value: token,
            domain: 'localhost',
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
    ])
}
