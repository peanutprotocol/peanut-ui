# Perk System - Frontend Implementation Spec

**Version:** 1.0 | **Date:** October 9, 2025

## Overview

Implement UI for sponsored QR payments. Users get surprise discounts (100% or partial) based on tier, with special merchant promos.

## Backend API Changes

### New Endpoint: Check Eligibility

```
GET /perks/eligibility?amountUsd=5.0&merchantIdentifier=optional
Authorization: Bearer <token>
```

**Response:**

```typescript
{
  isEligible: boolean
  reason: 'FIRST_PAYMENT' | 'ONGOING' | 'MERCHANT_PROMO' | 'AMOUNT_TOO_HIGH' | 'TIER_ZERO' | 'RANDOM_MISS' | 'FEATURE_DISABLED' | 'WALLET_LOW_BALANCE'
  probability: number  // 0.0 to 1.0
  discountPercentage: number  // 100 = fully sponsored, 50 = 50% off
  tier: number
  amountUsd: number
  merchantInfo?: {
    identifier: string
    promoDescription: string  // e.g., "Casa de Pizza - 50% off with Peanut!"
  }
}
```

### Updated: History API

```
GET /users/history
```

**History entries now include:**

```typescript
extraData: {
  perk?: {
    sponsored: boolean
    amountSponsored: number  // USD amount Peanut paid
    discountPercentage: number  // 100 or 50, etc
    txHash: string  // On-chain transaction
    merchantInfo?: {
      identifier: string
      promoDescription: string
    }
  }
}
```

## UI Flow

### 1. QR Payment Confirmation Screen

**Location:** `peanut-ui/src/components/Payment/Views/Confirm.payment.view.tsx`

**Before user confirms:**

```typescript
// Call eligibility API when amount is known
const { data: perkEligibility } = usePerks(amountUsd, merchantIdentifier)
```

**Display perk eligibility card if `perkEligibility?.isEligible === true`:**

```tsx
{
	perkEligibility?.isEligible && (
		<div className="perk-eligibility-card">
			<span className="perk-star">⭐</span>
			<h3>
				{perkEligibility.discountPercentage === 100
					? 'Eligible for FREE with Peanut!'
					: `${perkEligibility.discountPercentage}% off with Peanut!`}
			</h3>
			<p>{perkEligibility.merchantInfo?.promoDescription || 'Claim your perk now!'}</p>
			{perkEligibility.discountPercentage < 100 && (
				<div className="discount-savings">
					Save ${((amountUsd * perkEligibility.discountPercentage) / 100).toFixed(2)}
				</div>
			)}
		</div>
	)
}
```

**Modify confirmation button:**

```tsx
<Button onClick={handleClaimPerk} variant="gradient">
	{perkEligibility?.isEligible
		? `⭐ Claim ${perkEligibility.discountPercentage === 100 ? 'Free' : `${perkEligibility.discountPercentage}%`} Perk!`
		: 'Confirm Payment'}
</Button>
```

### 2. Perk Claim Animation

**New Component:** `peanut-ui/src/components/Payment/PerkClaimAnimation.tsx`

**Trigger when button clicked:**

1. Screen shake animation (CSS: `animation: shake 0.5s`)
2. Confetti burst (use `react-confetti` or similar)
3. Hold for 1 second
4. Navigate to success screen

```tsx
const handleClaimPerk = async () => {
	if (perkEligibility?.isEligible) {
		setShowConfetti(true)
		setScreenShake(true)

		// Wait for animation
		await new Promise((resolve) => setTimeout(resolve, 1000))

		// Complete payment
		await completePayment()
	} else {
		await completePayment()
	}
}
```

### 3. Success Screen

**Location:** `peanut-ui/src/components/Payment/Views/Status.payment.view.tsx`

**Check if payment was perked:**

```typescript
const perkInfo = paymentResult?.extraData?.perk
```

**Display success banner if sponsored:**

```tsx
{
	perkInfo?.sponsored && (
		<div className="perk-success-banner">
			<span className="perk-star-large">⭐</span>
			<h2>Peanut got you!</h2>
			<p>
				{perkInfo.discountPercentage === 100
					? 'We sponsored this bill!'
					: `We gave you ${perkInfo.discountPercentage}% off!`}
			</p>
			<div className="amount-display">
				{perkInfo.discountPercentage === 100 ? (
					<span className="strikethrough">${amountUsd.toFixed(2)}</span>
				) : (
					<>
						<span className="strikethrough">${amountUsd.toFixed(2)}</span>
						<span className="final-amount">${(amountUsd - perkInfo.amountSponsored).toFixed(2)}</span>
					</>
				)}
			</div>
			{perkInfo.merchantInfo && <p className="promo-text">{perkInfo.merchantInfo.promoDescription}</p>}
		</div>
	)
}
```

### 4. Transaction History

**Location:** `peanut-ui/src/components/Home/HomeHistory.tsx`

**For each history item, check for perk:**

```tsx
const perkInfo = item.extraData?.perk

return (
	<div className="history-item">
		{perkInfo?.sponsored && <span className="perk-badge">⭐</span>}

		<div className="amount">
			{perkInfo?.sponsored ? (
				perkInfo.discountPercentage === 100 ? (
					<>
						<span className="strikethrough">${item.amount}</span>
						<span className="perk-label">Sponsored by Peanut</span>
					</>
				) : (
					<>
						<span className="discount-badge">{perkInfo.discountPercentage}% off</span>
						<span className="final-amount">
							${(parseFloat(item.amount) - perkInfo.amountSponsored).toFixed(2)}
						</span>
					</>
				)
			) : (
				<span>${item.amount}</span>
			)}
		</div>

		{/* ... rest of history item ... */}
	</div>
)
```

## New Hook

**File:** `peanut-ui/src/hooks/usePerks.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

export interface PerkEligibility {
	isEligible: boolean
	reason: string
	probability: number
	discountPercentage: number
	tier: number
	amountUsd: number
	merchantInfo?: {
		identifier: string
		promoDescription: string
	}
}

export function usePerks(amountUsd?: number, merchantIdentifier?: string) {
	return useQuery({
		queryKey: ['perkEligibility', amountUsd, merchantIdentifier],
		queryFn: async () => {
			if (!amountUsd) return null

			const params = new URLSearchParams({
				amountUsd: amountUsd.toString(),
				...(merchantIdentifier && { merchantIdentifier }),
			})

			const response = await api.get(`/perks/eligibility?${params}`)
			return response.data as PerkEligibility
		},
		enabled: !!amountUsd,
		staleTime: 30000, // 30 seconds
	})
}
```

## TypeScript Interfaces

**File:** `peanut-ui/src/interfaces/interfaces.ts`

```typescript
export interface PerkEligibility {
	isEligible: boolean
	reason:
		| 'FIRST_PAYMENT'
		| 'ONGOING'
		| 'MERCHANT_PROMO'
		| 'AMOUNT_TOO_HIGH'
		| 'TIER_ZERO'
		| 'RANDOM_MISS'
		| 'FEATURE_DISABLED'
		| 'WALLET_LOW_BALANCE'
	probability: number
	discountPercentage: number
	tier: number
	amountUsd: number
	merchantInfo?: {
		identifier: string
		promoDescription: string
	}
}

export interface HistoryEntryPerk {
	sponsored: boolean
	amountSponsored: number
	discountPercentage: number
	txHash: string
	merchantInfo?: {
		identifier: string
		promoDescription: string
	}
}
```

## CSS/Styling

**Animations:**

```css
@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}
	25% {
		transform: translateX(-10px) rotate(-2deg);
	}
	75% {
		transform: translateX(10px) rotate(2deg);
	}
}

.screen-shake {
	animation: shake 0.5s ease-in-out;
}

.perk-star {
	font-size: 2em;
	animation: pulse 1s infinite;
}

@keyframes pulse {
	0%,
	100% {
		transform: scale(1);
	}
	50% {
		transform: scale(1.1);
	}
}
```

## Key Implementation Notes

1. **Non-blocking:** Perk check should NOT block payment flow. If API fails, proceed without perk.
2. **Surprise factor:** Don't show eligibility percentage to users - just "eligible" or not.
3. **Confetti library:** Use `react-confetti` or `canvas-confetti` for celebration effect.
4. **Merchant extraction:** Get merchant info from QR payment response: `qrPayment.details.merchant`
5. **Error handling:** Gracefully degrade if perk system unavailable.

## Testing Checklist

- [ ] Perk eligibility check on confirmation screen
- [ ] Confetti animation on claim
- [ ] Success screen shows "Peanut got you!" for 100% perks
- [ ] Success screen shows discount for partial perks
- [ ] History shows perk star for sponsored payments
- [ ] Strikethrough styling works correctly
- [ ] Works when merchant promo active
- [ ] Graceful degradation when perk API fails
- [ ] Mobile responsive
- [ ] Animations don't block user flow

## Deployment Notes

Backend requires:

- `PERK_WALLET_PRIVATE_KEY` env var
- Database migration for perk-manteca relation
- Config in `src/points-v2/constants.ts` (PERK_FEATURE_FLAGS)

Frontend changes are backward compatible - old clients work fine without perk UI.
