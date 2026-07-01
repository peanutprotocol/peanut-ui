'use client'

import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@/components/0_Bruddle/Button'
import Loading from '@/components/Global/Loading'
import { useRoomQuery, useCurrenciesQuery, useDeleteExpense } from '@/hooks/query/split'
import { getStoredMemberId, rememberRoom } from '@/utils/split-identity'
import { toCurrencyMap, formatMoney } from '@/utils/split-format'
import { IdentityGate } from './IdentityGate'
import { AddExpenseDrawer } from './AddExpenseDrawer'
import { SettleUpDrawer } from './SettleUpDrawer'
import { MemberAvatar } from './MemberAvatar'

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-peanut-repeat-normal">
			<div className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-white/90">{children}</div>
		</div>
	)
}

export function RoomView({ slug }: { slug: string }) {
	const roomQ = useRoomQuery(slug)
	const currenciesQ = useCurrenciesQuery()
	const deleteExpense = useDeleteExpense(slug)

	const [meId, setMeId] = useState<string | null>(null)
	const [addOpen, setAddOpen] = useState(false)
	const [settleOpen, setSettleOpen] = useState(false)
	const [copied, setCopied] = useState(false)

	useEffect(() => setMeId(getStoredMemberId(slug)), [slug])

	const room = roomQ.data
	useEffect(() => {
		if (room) rememberRoom(room.slug, room.title)
	}, [room])

	const currencies = currenciesQ.data ?? []
	const currencyMap = useMemo(() => toCurrencyMap(currencies), [currencies])
	const byId = useMemo(() => Object.fromEntries((room?.members ?? []).map((m) => [m.id, m])), [room])

	if (roomQ.isLoading) {
		return (
			<Shell>
				<div className="flex flex-1 items-center justify-center">
					<Loading />
				</div>
			</Shell>
		)
	}
	if (roomQ.isError || !room) {
		return (
			<Shell>
				<div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
					<div className="text-2xl font-extrabold text-n-1">Room not found</div>
					<div className="text-grey-1">This link may be wrong or the room was removed.</div>
				</div>
			</Shell>
		)
	}

	const meInRoom = !!meId && room.members.some((m) => m.id === meId)
	if (!meInRoom) {
		return (
			<Shell>
				<IdentityGate room={room} onPicked={setMeId} />
			</Shell>
		)
	}

	const myNet = BigInt(room.balances.find((b) => b.memberId === meId)?.netMinor ?? '0')

	const share = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			/* clipboard blocked — user can copy from the address bar */
		}
	}

	return (
		<Shell>
			{/* header */}
			<div className="flex items-center justify-between gap-2 border-b border-n-1 p-4">
				<div className="min-w-0">
					<div className="truncate text-xl font-extrabold text-n-1">{room.title || 'Split room'}</div>
					<div className="text-sm text-grey-1">
						{room.members.length} {room.members.length === 1 ? 'person' : 'people'} · {room.baseCurrency}
					</div>
				</div>
				<Button variant="stroke" size="medium" onClick={share}>
					{copied ? 'Copied!' : 'Share'}
				</Button>
			</div>

			<div className="flex flex-1 flex-col gap-5 overflow-auto p-4 pb-40">
				{/* your balance hero */}
				<div className="rounded-sm border border-n-1 bg-white p-5 text-center shadow-[4px_4px_0_0_#000]">
					{myNet === 0n ? (
						<div className="text-lg font-bold text-n-1">You’re all settled up 🥜</div>
					) : (
						<>
							<div className="text-sm font-semibold text-grey-1">{myNet > 0n ? 'You are owed' : 'You owe'}</div>
							<div className={twMerge('text-3xl font-extrabold', myNet > 0n ? 'text-n-1' : 'text-n-1')}>
								{formatMoney((myNet < 0n ? -myNet : myNet).toString(), room.baseCurrency, currencyMap)}
							</div>
						</>
					)}
				</div>

				{/* members + balances */}
				<div className="flex flex-col gap-1">
					<div className="text-sm font-semibold text-grey-1">Balances</div>
					{room.members.map((m) => {
						const net = BigInt(room.balances.find((b) => b.memberId === m.id)?.netMinor ?? '0')
						return (
							<div key={m.id} className="flex items-center gap-3 py-1.5">
								<MemberAvatar name={m.displayName} colorSeed={m.colorSeed} size={32} />
								<span className="flex-1 text-n-1">
									{m.displayName}
									{m.id === meId ? ' (you)' : ''}
								</span>
								<span className={twMerge('font-bold', net > 0n ? 'text-green-1' : net < 0n ? 'text-red' : 'text-grey-1')}>
									{net === 0n ? 'settled' : (net > 0n ? '+' : '−') + formatMoney((net < 0n ? -net : net).toString(), room.baseCurrency, currencyMap).replace(/^-/, '')}
								</span>
							</div>
						)
					})}
				</div>

				{/* expenses feed */}
				<div className="flex flex-col gap-2">
					<div className="text-sm font-semibold text-grey-1">Expenses</div>
					{room.expenses.length === 0 ? (
						<div className="rounded-sm border border-dashed border-grey-1 p-6 text-center text-grey-1">
							No expenses yet. Add the first one below.
						</div>
					) : (
						room.expenses.map((e) => {
							const payer = byId[e.paidByMemberId]
							const converted = e.currency !== room.baseCurrency
							return (
								<div key={e.id} className="flex items-center gap-3 rounded-sm border border-n-1 bg-white p-3">
									<div className="min-w-0 flex-1">
										<div className="truncate font-semibold text-n-1">{e.description}</div>
										<div className="text-sm text-grey-1">
											{payer ? payer.displayName : 'someone'} paid{' '}
											{formatMoney(e.amountMinor, e.currency, currencyMap)}
											{converted && ` · ${formatMoney(e.baseAmountMinor, room.baseCurrency, currencyMap)}`}
										</div>
									</div>
									<button
										onClick={() => deleteExpense.mutate(e.id)}
										className="px-2 text-grey-1 hover:text-red"
										aria-label="Delete expense"
									>
										✕
									</button>
								</div>
							)
						})
					)}
				</div>
			</div>

			{/* sticky actions */}
			<div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-xl border-t border-n-1 bg-white p-4">
				<div className="flex gap-2">
					<Button variant="purple" shadowSize="4" className="flex-1" onClick={() => setAddOpen(true)}>
						Add expense
					</Button>
					<Button variant="stroke" className="flex-1" onClick={() => setSettleOpen(true)}>
						Settle up
					</Button>
				</div>
			</div>

			<AddExpenseDrawer
				open={addOpen}
				onOpenChange={setAddOpen}
				room={room}
				meMemberId={meId!}
				currencies={currencies}
				currencyMap={currencyMap}
			/>
			<SettleUpDrawer open={settleOpen} onOpenChange={setSettleOpen} room={room} currencyMap={currencyMap} />
		</Shell>
	)
}
