/**
 * Shared e2e environment. One place to override API/UI bases and the harness
 * secret — previously each spec/util carried its own fallback literal and
 * they drifted (three different "default" secret strings across four files).
 *
 * TEST_HARNESS_SECRET is REQUIRED in all e2e environments — no literal
 * fallback. Hardcoded dev secrets have a way of leaking into the production
 * bundle.
 */

export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000'
export const UI_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:3000'

export function getHarnessSecret(): string {
	const secret = process.env.TEST_HARNESS_SECRET
	if (!secret) {
		throw new Error(
			'TEST_HARNESS_SECRET is not set. The e2e harness must match the value on the API side — ' +
				'set it in your shell (.env.e2e, bin/qa env, or direct export) before running tests.',
		)
	}
	return secret
}
