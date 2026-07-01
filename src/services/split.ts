// API client for link-based expense-splitting rooms. Talks to peanut-api-ts
// `/split/*` (unauthenticated — the room slug is the access control).

import { apiFetch } from '@/utils/api-fetch'
import type {
	RoomState,
	CurrencyInfo,
	NewExpenseInput,
	NewSettlementInput,
	MemberCreatedResponse,
} from '@/services/split.types'

async function unwrap<T>(res: Response): Promise<T> {
	const data = await res.json().catch(() => ({}) as unknown)
	if (!res.ok) {
		const message = (data as { message?: string })?.message ?? `request failed (${res.status})`
		throw new Error(message)
	}
	return data as T
}

export async function getCurrencies(): Promise<CurrencyInfo[]> {
	return unwrap(await apiFetch('/split/currencies', { method: 'GET' }))
}

export async function getRoom(slug: string): Promise<RoomState> {
	return unwrap(await apiFetch(`/split/rooms/${slug}`, { method: 'GET' }))
}

export async function createRoom(input: { title?: string; baseCurrency: string }): Promise<RoomState> {
	return unwrap(await apiFetch('/split/rooms', { method: 'POST', body: JSON.stringify(input) }))
}

export async function addMember(slug: string, displayName: string): Promise<MemberCreatedResponse> {
	return unwrap(
		await apiFetch(`/split/rooms/${slug}/members`, { method: 'POST', body: JSON.stringify({ displayName }) })
	)
}

export async function addExpense(slug: string, input: NewExpenseInput): Promise<RoomState> {
	return unwrap(await apiFetch(`/split/rooms/${slug}/expenses`, { method: 'POST', body: JSON.stringify(input) }))
}

export async function updateExpense(slug: string, expenseId: string, input: NewExpenseInput): Promise<RoomState> {
	return unwrap(
		await apiFetch(`/split/rooms/${slug}/expenses/${expenseId}`, { method: 'PATCH', body: JSON.stringify(input) })
	)
}

export async function deleteExpense(slug: string, expenseId: string): Promise<RoomState> {
	return unwrap(await apiFetch(`/split/rooms/${slug}/expenses/${expenseId}`, { method: 'DELETE' }))
}

export async function restoreExpense(slug: string, expenseId: string): Promise<RoomState> {
	return unwrap(await apiFetch(`/split/rooms/${slug}/expenses/${expenseId}/restore`, { method: 'POST' }))
}

export async function recordSettlement(slug: string, input: NewSettlementInput): Promise<RoomState> {
	return unwrap(await apiFetch(`/split/rooms/${slug}/settlements`, { method: 'POST', body: JSON.stringify(input) }))
}

export async function deleteSettlement(slug: string, settlementId: string): Promise<RoomState> {
	return unwrap(await apiFetch(`/split/rooms/${slug}/settlements/${settlementId}`, { method: 'DELETE' }))
}
