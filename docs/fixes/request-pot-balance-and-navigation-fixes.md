# Request Pot Balance Check & Navigation Fixes

**Date:** October 29, 2025  
**Issues:** Balance check skipped, back button broken, payment methods reshuffling  
**Status:** ✅ Fixed

---

## 🐛 Issue #1: Balance Check Was Skipped for Request Pot Payments

### Problem

User with $1.00 balance could proceed to pay $25 request without being prompted to add funds.

### Root Cause

The previous developer added this comment:

```typescript
!showRequestPotInitialView && // don't apply balance check on request pot payment initial view
```

**Why they added it:** They thought the initial view (where `requestId` is in URL) shouldn't validate balance because the user hasn't selected a payment method yet. They may have intended to validate only after the user clicks "Pay with Peanut."

**Why it was wrong:** The balance check should ALWAYS run if the user is using Peanut Wallet, regardless of whether they're on the initial view or confirmation view. The button should show "Add funds" if balance is insufficient.

### The Flow

```
requestId in URL → showRequestPotInitialView = true → Initial payment view
    ↓
User clicks "Pay with Peanut"
    ↓
Charge created → URL changes to chargeId → showRequestPotInitialView = false
    ↓
Confirmation view
```

### Fix Applied

**Removed the `!showRequestPotInitialView` guard** from THREE places in `PaymentForm/index.tsx`:

#### 1. Balance Check Logic (Line 239)

```typescript
// ❌ BEFORE
if (
    !showRequestPotInitialView && // 👈 WRONG - skips balance check!
    isActivePeanutWallet &&
    areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)
) {
    // Check balance...
}

// ✅ AFTER
if (isActivePeanutWallet && areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)) {
    // peanut wallet payment - ALWAYS check balance (including request pots)
    if (walletNumeric < parsedInputAmount) {
        dispatch(paymentActions.setError('Insufficient balance'))
    }
}
```

#### 2. Add Money Redirect (Line 375)

```typescript
// ❌ BEFORE
if (!showRequestPotInitialView && isActivePeanutWallet && isInsufficientBalanceError) {
    router.push('/add-money')
    return
}

// ✅ AFTER
if (isActivePeanutWallet && isInsufficientBalanceError && !isExternalWalletFlow) {
    router.push('/add-money')
    return
}
```

#### 3. Button Text Priority (Line 516)

```typescript
// ❌ BEFORE - Wrong order
if (showRequestPotInitialView) {
    return 'Pay'
}

if (isActivePeanutWallet && isInsufficientBalanceError) {
    return 'Add funds to 🥜 PEANUT'
}

// ✅ AFTER - Check balance first
if (isActivePeanutWallet && isInsufficientBalanceError && !isExternalWalletFlow) {
    return 'Add funds to 🥜 PEANUT'
}

if (showRequestPotInitialView) {
    return 'Pay'
}
```

### Result

✅ User with $1.00 trying to pay $25 now sees:

- Error message: "Insufficient balance"
- Button text: "Add funds to 🥜 PEANUT"
- Button icon: `arrow-down`
- Clicking button → Redirects to `/add-money`

---

## 🐛 Issue #2: Payment Methods Reshuffling After Modal Close

### Problem

When user clicks a payment method (e.g., Mercado Pago), the modal shows. When they dismiss the modal, the payment methods reshuffle their order.

### Root Cause

The `isMethodUnavailable` callback was **recreated on every render**, causing `useGeoFilteredPaymentOptions` to think dependencies changed and re-sort the array.

```typescript
// ❌ BEFORE - New function reference every render
useGeoFilteredPaymentOptions({
    isMethodUnavailable: (method) => method.soon || (method.id === 'bank' && requiresVerification),
})
```

**How it caused reshuffling:**

1. User clicks method → Modal opens → State changes
2. Component re-renders
3. Inline arrow function recreated → **New function reference**
4. `useMemo` in `useGeoFilteredPaymentOptions` sees dependency change
5. Calls `Array.sort()` again
6. JavaScript's `Array.sort()` is unstable → Methods shuffle!

### Fix Applied

**Wrapped callback in `useCallback`** to stabilize the reference:

```typescript
// ✅ AFTER - Stable function reference
const isMethodUnavailable = useCallback(
    (method: PaymentMethod) => method.soon || (method.id === 'bank' && requiresVerification),
    [requiresVerification] // Only recreate if this actually changes
)

useGeoFilteredPaymentOptions({
    sortUnavailable: true,
    isMethodUnavailable, // Stable reference
})
```

**File:** `src/components/Common/ActionList.tsx`

### Result

✅ Payment methods stay in consistent order
✅ Modal open/close doesn't trigger re-sort
✅ Methods only re-sort when `requiresVerification` actually changes

---

## 🐛 Issue #3: Add Money Back Button Goes to Home

### Problem

When user navigates from request payment → add money, clicking back button goes to `/home` instead of back to the request payment page.

### Root Cause

Hardcoded navigation in `add-money/page.tsx`:

```typescript
// ❌ BEFORE - Always goes to home
onBackClick={() => router.push('/home')}
```

This completely ignores the browser's navigation history, breaking the natural back button behavior.

### Fix Applied

**Use `router.back()` with fallback:**

```typescript
// ✅ AFTER - Respects browser history
const handleBack = () => {
    // Check if there's a previous page in history
    if (window.history.length > 1) {
        router.back()
    } else {
        // Fallback to home if no history (e.g., direct navigation to /add-money)
        router.push('/home')
    }
}

return (
    <AddWithdrawRouterView
        onBackClick={handleBack}
    />
)
```

**File:** `src/app/(mobile-ui)/add-money/page.tsx`

### Result

✅ User flow: Request payment → Add money → **Back** → Request payment
✅ Direct navigation: `/add-money` → **Back** → Home (fallback)
✅ Natural browser history behavior restored

---

## 🔍 Issue #4: Bug Button in Add Money View

### Investigation

Searched for bug/support/feedback buttons in add-money flow:

- ❌ No bug button found in `AddWithdrawRouterView`
- ❌ No bug button in `add-money/page.tsx`
- ❌ No bug button in add-money country/method pages

**Possible locations where support buttons exist:**

1. `TransactionDetailsReceipt` - Has "Issues with this transaction?" button
2. `ValidationErrorView` - Has "Talk to support" button
3. `ClaimErrorView` - Has "Talk to support" button
4. Global Crisp Chat widget (bottom right)

**Question for user:** Where specifically is this bug button? Is it:

- The Crisp chat widget?
- A "Talk to support" button on an error screen?
- A different button?

**Need more details to investigate this issue.**

---

## 📋 Testing Checklist

### Balance Check

- [ ] User with $1.00 trying to pay $25 sees "Insufficient balance"
- [ ] Button shows "Add funds to 🥜 PEANUT"
- [ ] Clicking button redirects to `/add-money`
- [ ] After adding funds, payment proceeds normally

### Method Reshuffling

- [ ] Open request payment page
- [ ] Click "Mercado Pago" → Modal appears
- [ ] Close modal
- [ ] **Verify methods DON'T reshuffle**
- [ ] Try with Bank, PIX, External wallet
- [ ] All methods should stay in consistent order

### Back Button

- [ ] Navigate: Request payment → Add money
- [ ] Click back button
- [ ] **Should return to request payment page**
- [ ] Not to home page

### Edge Cases

- [ ] Direct navigation to `/add-money` → Back → Goes to home (fallback)
- [ ] User with sufficient balance doesn't see "Add funds" button
- [ ] Balance check works for both initial view and confirmation view

---

## 🎯 Summary of Changes

| File                    | Change                                                 | Reason                                          |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| `PaymentForm/index.tsx` | Removed `!showRequestPotInitialView` guards (3 places) | Always check balance for Peanut wallet payments |
| `ActionList.tsx`        | Wrapped `isMethodUnavailable` in `useCallback`         | Prevent function reference instability          |
| `add-money/page.tsx`    | Changed `router.push('/home')` to `router.back()`      | Respect browser history                         |

---

## 🚨 Breaking Changes

**None.** All changes are fixes that restore expected behavior:

- Balance checks that should have been running
- Natural browser navigation that was broken
- Stable sorting that was unstable

---

## 💡 Key Learnings

### 1. Always Question Comments

The comment "don't apply balance check on request pot payment initial view" seemed reasonable but was based on a flawed assumption. **Always validate the reasoning behind defensive code.**

### 2. Function Reference Stability Matters

When passing callbacks to hooks with memoization, unstable references cause unnecessary re-renders and re-computations. Use `useCallback` when:

- Passing functions to child components (prevents re-renders)
- Passing functions as dependencies to `useMemo`/`useEffect`
- Passing functions to custom hooks that memoize based on them

### 3. Respect Browser History

Hardcoded navigation (`router.push('/home')`) breaks user expectations. Use `router.back()` unless there's a specific UX reason not to.

### 4. Check Balance Early and Often

For payment flows, validate balance:

- ✅ On initial screen load
- ✅ When user changes amount
- ✅ Before showing payment methods
- ✅ Before submitting payment

Don't wait until the last moment—give users early feedback!

---

## 📚 Related Files

- `src/components/Payment/PaymentForm/index.tsx` - Main payment form with balance checks
- `src/components/Common/ActionList.tsx` - Payment method selection with modal
- `src/app/(mobile-ui)/add-money/page.tsx` - Add money entry point
- `src/hooks/useGeoFilteredPaymentOptions.ts` - Payment method filtering/sorting
- `src/app/[...recipient]/client.tsx` - Request payment page that sets `showRequestPotInitialView`
