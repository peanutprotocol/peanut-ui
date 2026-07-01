'use client'

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { Button } from '@/components/0_Bruddle/Button'
import { MemberAvatar } from './MemberAvatar'
import { useRecordSettlement } from '@/hooks/query/split'
import { formatMoney, type CurrencyMap } from '@/utils/split-format'
import type { RoomState } from '@/services/split.types'

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
	room: RoomState
	currencyMap: CurrencyMap
}

export function SettleUpDrawer({ open, onOpenChange, room, currencyMap }: Props) {
	const settle = useRecordSettlement(room.slug)
	const byId = Object.fromEntries(room.members.map((m) => [m.id, m]))

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle className="text-xl font-extrabold text-n-1">Settle up</DrawerTitle>
				</DrawerHeader>

				<div className="flex flex-col gap-3 px-4 pb-6">
					{room.suggestedTransfers.length === 0 ? (
						<div className="py-8 text-center text-lg font-semibold text-n-1">You’re all settled up 🥜</div>
					) : (
						<>
							<p className="text-sm text-grey-1">
								The fewest payments to square everyone up. Pay each other back in person or by bank, then mark it
								paid here.
							</p>
							{room.suggestedTransfers.map((t, i) => {
								const from = byId[t.fromMemberId]
								const to = byId[t.toMemberId]
								if (!from || !to) return null
								return (
									<div key={i} className="flex flex-col gap-3 rounded-sm border border-n-1 bg-white p-4">
										<div className="flex items-center gap-2">
											<MemberAvatar name={from.displayName} colorSeed={from.colorSeed} size={30} />
											<span className="font-semibold text-n-1">{from.displayName}</span>
											<span className="text-grey-1">pays</span>
											<MemberAvatar name={to.displayName} colorSeed={to.colorSeed} size={30} />
											<span className="font-semibold text-n-1">{to.displayName}</span>
											<span className="ml-auto text-lg font-extrabold text-n-1">
												{formatMoney(t.amountMinor, room.baseCurrency, currencyMap)}
											</span>
										</div>
										<div className="flex gap-2">
											<Button variant="stroke" className="flex-1" disabled title="Coming soon">
												Pay with Peanut · soon
											</Button>
											<Button
												variant="dark"
												className="flex-1"
												loading={settle.isPending}
												onClick={() =>
													settle.mutate({
														fromMemberId: t.fromMemberId,
														toMemberId: t.toMemberId,
														amountMinor: t.amountMinor,
														method: 'MANUAL',
													})
												}
											>
												Mark as paid
											</Button>
										</div>
									</div>
								)
							})}
						</>
					)}
				</div>
			</DrawerContent>
		</Drawer>
	)
}
