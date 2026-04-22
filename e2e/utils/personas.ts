/**
 * Test personas for E2E tests.
 *
 * Each persona represents a user in a specific state (verified AR, verified US,
 * user with history, etc). Personas are created during global-setup via the
 * API's /dev/test-session and /dev/seed-scenario endpoints, then saved to a
 * JSON file that individual tests read.
 *
 * This avoids the "all tests use the same empty new-user" problem — tests
 * that need a verified AR user or a user with transaction history can pick
 * the right persona instead of faking it.
 */

import type { BrowserContext } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000'
const HARNESS_SECRET = process.env.TEST_HARNESS_SECRET || 'local-harness-secret-long-enough-32ch'
const PERSONAS_PATH = path.resolve(__dirname, '../.auth/personas.json')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Persona {
	id: string
	token: string
	userId: string
	username: string
}

export type PersonaId = 'default' | 'verified-ar' | 'verified-us' | 'with-history'

type PersonaMap = Record<PersonaId, Persona>

// ---------------------------------------------------------------------------
// Persona definitions — what to request from the API
// ---------------------------------------------------------------------------

interface PersonaSpec {
	id: PersonaId
	/** Use test-session to create user with these params */
	session?: {
		email: string
		kyc: string
		country: string
	}
	/** Use seed-scenario after session creation (or standalone) */
	seedScenario?: string
}

const PERSONA_SPECS: PersonaSpec[] = [
	{
		id: 'verified-ar',
		session: {
			email: `persona-ar-${Date.now()}@test.local`,
			kyc: 'verified',
			country: 'AR',
		},
	},
	{
		id: 'verified-us',
		session: {
			email: `persona-us-${Date.now()}@test.local`,
			kyc: 'verified',
			country: 'US',
		},
	},
	{
		id: 'with-history',
		seedScenario: 'withdraw-ready',
	},
]

// ---------------------------------------------------------------------------
// Creation (called from global-setup)
// ---------------------------------------------------------------------------

async function createSessionPersona(spec: PersonaSpec): Promise<Persona> {
	if (!spec.session) {
		throw new Error(`Persona ${spec.id} has no session config`)
	}

	const res = await fetch(`${API_BASE}/dev/test-session`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-test-harness-secret': HARNESS_SECRET,
		},
		body: JSON.stringify({
			...spec.session,
			harnessLabel: `persona-${spec.id}`,
		}),
	})

	if (!res.ok) {
		const body = await res.text().catch(() => '<unreadable>')
		throw new Error(`test-session for persona "${spec.id}" failed: ${res.status} — ${body}`)
	}

	const { token, user } = (await res.json()) as {
		token: string
		user: { userId: string; email: string; username?: string }
	}

	return {
		id: spec.id,
		token,
		userId: user.userId,
		username: user.username || user.email,
	}
}

async function createSeededPersona(spec: PersonaSpec): Promise<Persona> {
	if (!spec.seedScenario) {
		throw new Error(`Persona ${spec.id} has no seedScenario config`)
	}

	const res = await fetch(`${API_BASE}/dev/seed-scenario`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-test-harness-secret': HARNESS_SECRET,
		},
		body: JSON.stringify({
			scenario: spec.seedScenario,
			harnessLabel: `persona-${spec.id}`,
		}),
	})

	if (!res.ok) {
		const body = await res.text().catch(() => '<unreadable>')
		throw new Error(`seed-scenario for persona "${spec.id}" failed: ${res.status} — ${body}`)
	}

	const json = await res.json()
	const data = json.data

	// seed-scenario returns { data: { user: { token, userId, ... } } }
	if (!data?.user?.token) {
		throw new Error(
			`seed-scenario "${spec.seedScenario}" didn't return user token. ` +
				`Got: ${JSON.stringify(data).slice(0, 200)}`
		)
	}

	return {
		id: spec.id,
		token: data.user.token,
		userId: data.user.userId,
		username: data.user.username || data.user.email || spec.id,
	}
}

/**
 * Create all personas and save them to disk.
 * Called from global-setup.ts. Non-fatal: if a persona fails, it's skipped
 * and tests that need it will fall back to the default user.
 */
export async function createAllPersonas(defaultToken: string, defaultUserId: string, defaultUsername: string): Promise<PersonaMap> {
	const personas: Partial<PersonaMap> = {
		default: {
			id: 'default',
			token: defaultToken,
			userId: defaultUserId,
			username: defaultUsername,
		},
	}

	for (const spec of PERSONA_SPECS) {
		try {
			let persona: Persona
			if (spec.seedScenario) {
				persona = await createSeededPersona(spec)
			} else {
				persona = await createSessionPersona(spec)
			}
			personas[spec.id] = persona
			console.log(`[personas] Created "${spec.id}" — user ${persona.userId}`)
		} catch (e) {
			console.warn(`[personas] Failed to create "${spec.id}": ${(e as Error).message}`)
		}
	}

	// Write to disk for tests to read
	const dir = path.dirname(PERSONAS_PATH)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
	fs.writeFileSync(PERSONAS_PATH, JSON.stringify(personas, null, 2))
	console.log(`[personas] Saved ${Object.keys(personas).length} personas to ${PERSONAS_PATH}`)

	return personas as PersonaMap
}

// ---------------------------------------------------------------------------
// Read (called from test specs)
// ---------------------------------------------------------------------------

let _cached: Partial<PersonaMap> | null = null

/**
 * Get a persona by ID. Returns the persona if available, or null if it
 * wasn't created (API was down, scenario doesn't exist, etc).
 *
 * Tests should gracefully fall back to the default user when a persona
 * isn't available:
 *
 * ```ts
 * const persona = getPersona('verified-ar')
 * if (persona) {
 *   await authenticateAs(context, persona.token)
 * }
 * ```
 */
export function getPersona(id: PersonaId): Persona | null {
	if (!_cached) {
		try {
			const raw = fs.readFileSync(PERSONAS_PATH, 'utf-8')
			_cached = JSON.parse(raw) as Partial<PersonaMap>
		} catch {
			console.warn(`[personas] Could not read ${PERSONAS_PATH} — no personas available`)
			_cached = {}
		}
	}
	return _cached[id] || null
}

/**
 * Convenience: authenticate a browser context as a specific persona.
 * Returns true if persona was found and applied, false if not available
 * (caller should use default user).
 */
export async function usePersona(
	context: BrowserContext,
	id: PersonaId
): Promise<Persona | null> {
	const persona = getPersona(id)
	if (!persona) {
		console.warn(`[personas] Persona "${id}" not available — using default user`)
		return null
	}

	await context.addCookies([
		{
			name: 'jwt-token',
			value: persona.token,
			domain: 'localhost',
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'Lax',
		},
	])

	return persona
}
