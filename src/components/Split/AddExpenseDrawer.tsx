'use client'

import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/Global/Drawer'
import { Button } from '@/components/0_Bruddle/Button'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { MemberAvatar } from './MemberAvatar'
import { useAddExpense } from '@/hooks/query/split'
import { toMinorString, formatMoney, type CurrencyMap } from '@/utils/split-format'
import type { RoomState, CurrencyInfo, SplitKind } from '@/services/split.types'

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
	room: RoomState
	meMemberId: string
	currencies: CurrencyInfo[]
	currencyMap: CurrencyMap
}

export function AddExpenseDrawer({ open, onOpenChange, room, meMemberId, currencies, currencyMap }: Props) {
	const addExpense = useAddExpense(room.slug)
	const [description, setDescription] = useState('')
	const [amount, setAmount] = useState('')
	const [currency, setCurrency] = useState(room.baseCurrency)
	const [paidBy, setPaidBy] = useState(meMemberId)
	const [kind, setKind] = useState<SplitKind>('EQUAL')
	const [participants, setParticipants] = useState<Set<string>>(new Set(room.members.map((m) => m.id)))
	const [exact, setExact] = useState<Record<string, string>>({})

	const decimals = currencyMap[currency]?.decimals ?? 2
	const totalMinor = BigInt(toMinorString(amount, decimals))

	const exactSumMinor = useMemo(
		() =>
			room.members.reduce((sum, m) => {
				const v = exact[m.id]
				return v ? sum + BigInt(toMinorString(v, decimals)) : sum
			}, 0n),
		[exact, room.members, decimals]
	)
	const exactRemaining = totalMinor - exactSumMinor

	const canSubmit =
		totalMinor > 0n &&
		!addExpense.isPending &&
		(kind === 'EQUAL' ? participants.size > 0 : exactSumMinor > 0n && exactRemaining === 0n)

	const reset = () => {
		setDescription('')
		setAmount('')
		setCurrency(room.baseCurrency)
		setPaidBy(meMemberId)
		setKind('EQUAL')
		setParticipants(new Set(room.members.map((m) => m.id)))
		setExact({})
	}

	const submit = async () => {
		if (!canSubmit) return
		if (kind === 'EQUAL') {
			await addExpense.mutateAsync({
				description: description.trim() || 'Expense',
				amountMinor: totalMinor.toString(),
				currency,
				paidByMemberId: paidBy,
				splitKind: 'EQUAL',
				participantMemberIds: [...participants],
				createdByMemberId: meMemberId,
			})
		} else {
			const exactShares = room.members
				.filter((m) => exact[m.id] && BigInt(toMinorString(exact[m.id], decimals)) > 0n)
				.map((m) => ({ memberId: m.id, amountMinor: toMinorString(exact[m.id], decimals) }))
			await addExpense.mutateAsync({
				description: description.trim() || 'Expense',
				amountMinor: totalMinor.toString(),
				currency,
				paidByMemberId: paidBy,
				splitKind: 'EXACT',
				exactShares,
				createdByMemberId: meMemberId,
			})
		}
		reset()
		onOpenChange(false)
	}

	const toggleParticipant = (id: string) => {
		setParticipants((prev) => {
			const next = new Set(prev)
			next.has(id) ? next.delete(id) : next.add(id)
			return next
		})
	}

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle className="text-xl font-extrabold text-n-1">Add expense</DrawerTitle>
				</DrawerHeader>

				<div className="flex flex-col gap-4 px-4 pb-2">
					<BaseInput
						placeholder="What was it for?"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						maxLength={255}
					/>

					<div className="flex gap-2">
						<BaseInput
							className="flex-1"
							placeholder="0.00"
							inputMode="decimal"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
						/>
						<select
							className="input h-16 w-28 px-3"
							value={currency}
							onChange={(e) => setCurrency(e.target.value)}
						>
							{currencies.map((c) => (
								<option key={c.code} value={c.code}>
									{c.code}
								</option>
							))}
						</select>
					</div>
					{currency !== room.baseCurrency && totalMinor > 0n && (
						<div className="-mt-2 text-sm text-grey-1">Balances shown in {room.baseCurrency} at today’s rate.</div>
					)}

					<label className="flex flex-col gap-1">
						<span className="text-sm font-semibold text-grey-1">Paid by</span>
						<select className="input h-12 px-3" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
							{room.members.map((m) => (
								<option key={m.id} value={m.id}>
									{m.displayName}
									{m.id === meMemberId ? ' (you)' : ''}
								</option>
							))}
						</select>
					</label>

					<div className="flex rounded-sm border border-n-1 p-1">
						{(['EQUAL', 'EXACT'] as SplitKind[]).map((k) => (
							<button
								key={k}
								onClick={() => setKind(k)}
								className={twMerge(
									'flex-1 rounded-sm py-2 text-sm font-bold',
									kind === k ? 'bg-n-1 text-white' : 'text-n-1'
								)}
							>
								{k === 'EQUAL' ? 'Split equally' : 'Exact amounts'}
							</button>
						))}
					</div>

					<div className="flex flex-col gap-1">
						{room.members.map((m) => (
							<div key={m.id} className="flex items-center gap-3 py-1">
								<MemberAvatar name={m.displayName} colorSeed={m.colorSeed} size={30} />
								<span className="flex-1 text-n-1">{m.displayName}</span>
								{kind === 'EQUAL' ? (
									<input
										type="checkbox"
										className="size-5 accent-n-1"
										checked={participants.has(m.id)}
										onChange={() => toggleParticipant(m.id)}
									/>
								) : (
									<input
										className="input h-10 w-28 px-3 text-right"
										inputMode="decimal"
										placeholder="0.00"
										value={exact[m.id] ?? ''}
										onChange={(e) => setExact((prev) => ({ ...prev, [m.id]: e.target.value }))}
									/>
								)}
							</div>
						))}
					</div>

					{kind === 'EXACT' && totalMinor > 0n && exactRemaining !== 0n && (
						<div className="text-sm text-red">
							{exactRemaining > 0n ? 'Unassigned' : 'Over by'} {formatMoney(
								(exactRemaining < 0n ? -exactRemaining : exactRemaining).toString(),
								currency,
								currencyMap
							)}
						</div>
					)}
					{addExpense.isError && <div className="text-sm text-red">Couldn’t add the expense — check the amounts.</div>}
				</div>

				<DrawerFooter>
					<Button variant="purple" shadowSize="4" className="w-full" loading={addExpense.isPending} disabled={!canSubmit} onClick={submit}>
						Add expense
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	)
}
