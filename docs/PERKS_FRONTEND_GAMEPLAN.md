# Perks Frontend - Implementation Gameplan

**Status:** Backend Complete ✅ | Frontend TODO  
**Target Repo:** `../peanut-ui`

---

## 🎯 Goal

Add "surprise discount" UI to QR payments - users get 100% or partial sponsorship based on tier and merchant promos.

---

## 📋 Step-by-Step Checklist

### Step 1: Backend Endpoints (Already Done ✅)

- ✅ `GET /perks/eligibility?amountUsd=X&merchantIdentifier=Y` - Check if user eligible
- ✅ History API updated with `extraData.perk` field
- ✅ Perk issuance happens automatically after QR payment

### Step 2: Create Hook (15 min)

**File:** `peanut-ui/src/hooks/usePerks.ts`

```typescript
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
		staleTime: 30000,
	})
}
```

**Dependencies:**

- Add TypeScript interfaces (see `docs/PERKS_FRONTEND_SPEC.md` lines 252-286)

### Step 3: Update QR Payment Confirmation Screen (30 min)

**File:** `peanut-ui/src/components/Payment/Views/Confirm.payment.view.tsx`

**What to do:**

1. Call `usePerks(amountUsd, merchantIdentifier)` when amount known
2. Show perk eligibility card if `isEligible === true`:
    - Display star emoji ⭐
    - Show "Eligible for FREE!" or "X% off with Peanut!"
    - Show merchant promo text if available
3. Update button text to "⭐ Claim Free Perk!" or "⭐ Claim 50% Perk!"

**Design:** See mockup in excalidraw (link in PR.md)

### Step 4: Add Perk Claim Animation (20 min)

**File:** `peanut-ui/src/components/Payment/PerkClaimAnimation.tsx` (NEW)

**What to do:**

1. Screen shake animation (CSS keyframes)
2. Confetti burst (use `react-confetti` or `canvas-confetti`)
3. 1-second hold, then proceed with payment

**Trigger:** When user clicks "Claim Perk" button

### Step 5: Update Success Screen (20 min)

**File:** `peanut-ui/src/components/Payment/Views/Status.payment.view.tsx`

**What to do:**

1. Check if payment response has `extraData.perk.sponsored === true`
2. Show special banner:
    - "🎉 Peanut got you!"
    - "We sponsored this bill!" (if 100%) or "We gave you 50% off!" (if partial)
    - Strike through original amount
    - Show final amount (for partial discounts)

### Step 6: Update Transaction History (25 min)

**File:** `peanut-ui/src/components/Home/HomeHistory.tsx`

**What to do:**

1. For each history item, check `item.extraData?.perk`
2. If sponsored:
    - Add perk star badge ⭐
    - Strike through original amount
    - Add "Sponsored by Peanut" label (if 100%)
    - Show discount badge + final amount (if partial)

### Step 7: Add CSS Styling (15 min)

**Files:**

- `peanut-ui/src/styles/perks.css` (NEW)

**Animations needed:**

- Shake animation for screen
- Pulse animation for star
- Strikethrough styling for amounts
- Gradient button variant (optional)

**See:** `docs/PERKS_FRONTEND_SPEC.md` lines 292-324 for CSS code

### Step 8: Testing (30 min)

**Manual Tests:**

1. Make QR payment under $9.42
2. Verify perk eligibility shows on confirmation
3. Click "Claim Perk" → confetti + shake
4. Success screen shows "Peanut got you!"
5. History shows perk star and strikethrough
6. Test with no perk (should still work normally)
7. Test API failure (should gracefully degrade)

---

## 📊 File Checklist

### New Files

- [ ] `src/hooks/usePerks.ts`
- [ ] `src/components/Payment/PerkClaimAnimation.tsx`
- [ ] `src/styles/perks.css`

### Modified Files

- [ ] `src/components/Payment/Views/Confirm.payment.view.tsx`
- [ ] `src/components/Payment/Views/Status.payment.view.tsx`
- [ ] `src/components/Home/HomeHistory.tsx`
- [ ] `src/interfaces/interfaces.ts` (add PerkEligibility, HistoryEntryPerk)

### Dependencies to Install

- [ ] `react-confetti` or `canvas-confetti` (for celebration effect)

---

## 🚨 Important Notes

1. **Non-blocking:** Perk check should NEVER block payment. If API fails, proceed without perk.
2. **Backward compatible:** Old app versions will work fine, just won't show perk UI.
3. **Surprise factor:** Don't show probability percentages to users.
4. **Merchant data:** Extract from `qrPayment.details.merchant` response.
5. **Error handling:** Always have fallback UI if perk system unavailable.

---

## 📚 Reference Docs

- **Full Spec:** `docs/PERKS_FRONTEND_SPEC.md` (comprehensive with code examples)
- **Backend Summary:** `docs/PERKS_IMPLEMENTATION_SUMMARY.md`
- **API Details:** Lines 9-56 in PERKS_FRONTEND_SPEC.md
- **Design Mockups:** See PR.md for excalidraw link

---

## ⏱️ Time Estimate

- Hook + Interfaces: **15 min**
- Confirmation Screen: **30 min**
- Animation Component: **20 min**
- Success Screen: **20 min**
- History Updates: **25 min**
- CSS Styling: **15 min**
- Testing + Fixes: **30 min**

**Total: ~2.5 hours** (including testing)

---

## 🚀 Deployment

Frontend can be deployed independently. Backend is already live and backward compatible.

**Rollout:**

1. Deploy frontend changes
2. Fund perk wallet with USDC on Arbitrum
3. Monitor Discord for perk notifications
4. Verify first few perks manually on Arbiscan

---

**Questions?** See `docs/PERKS_FRONTEND_SPEC.md` or ping backend team.
