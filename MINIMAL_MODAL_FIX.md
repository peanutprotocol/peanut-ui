# Minimal Modal Fix - Safe for Prod Release

## Issue Found: Duplicate Balance Warning Modal Logic

**File:** `peanut-ui/src/app/(mobile-ui)/home/page.tsx`  
**Lines:** 146-168 AND 170-191  
**Severity:** 🔴 Critical Bug

### The Problem

There are **TWO identical useEffect blocks** for the balance warning modal. This means the logic runs twice every time dependencies change.

**First block (lines 146-168):**

```typescript
// effect for showing balance warning modal
useEffect(() => {
    if (isFetchingBalance || balance === undefined || !user) return

    if (typeof window !== 'undefined') {
        const hasSeenBalanceWarning = getFromLocalStorage(`${user!.user.userId}-hasSeenBalanceWarning`)
        const balanceInUsd = Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))

        if (
            balanceInUsd > BALANCE_WARNING_THRESHOLD &&
            !hasSeenBalanceWarning &&
            !showIOSPWAInstallModal &&
            !showAddMoneyPromptModal &&
            !isPostSignupActionModalVisible // ← HAS THIS CHECK
        ) {
            setShowBalanceWarningModal(true)
        }
    }
}, [balance, isFetchingBalance, showIOSPWAInstallModal, showAddMoneyPromptModal, user])
//   ↑ Missing isPostSignupActionModalVisible in dependency array
```

**Second block (lines 170-191):**

```typescript
// effect for showing balance warning modal  ← SAME COMMENT
useEffect(() => {
    if (isFetchingBalance || balance === undefined || !user) return

    if (typeof window !== 'undefined') {
        const hasSeenBalanceWarning = getFromLocalStorage(`${user!.user.userId}-hasSeenBalanceWarning`)
        const balanceInUsd = Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))

        if (
            balanceInUsd > BALANCE_WARNING_THRESHOLD &&
            !hasSeenBalanceWarning &&
            !showIOSPWAInstallModal &&
            !showAddMoneyPromptModal
            // ← MISSING !isPostSignupActionModalVisible CHECK
        ) {
            setShowBalanceWarningModal(true)
        }
    }
}, [balance, isFetchingBalance, showIOSPWAInstallModal, showAddMoneyPromptModal, user])
//   ↑ Also missing isPostSignupActionModalVisible
```

### Impact

1. **Performance:** Logic runs twice unnecessarily
2. **Bugs:** Can cause race conditions and unexpected behavior
3. **Maintenance:** Changes need to be made in two places
4. **Inconsistency:** First block has more checks than second block

### The Fix

**Option 1: Delete First Block (Recommended - Simpler)**

Delete lines 146-169 entirely. Keep only the second block but add the missing check:

```typescript
// effect for showing balance warning modal
useEffect(() => {
    if (isFetchingBalance || balance === undefined || !user) return

    if (typeof window !== 'undefined') {
        const hasSeenBalanceWarning = getFromLocalStorage(`${user!.user.userId}-hasSeenBalanceWarning`)
        const balanceInUsd = Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))

        // show if:
        // 1. balance is above the threshold
        // 2. user hasn't seen this warning in the current session
        // 3. no other modals are currently active
        if (
            balanceInUsd > BALANCE_WARNING_THRESHOLD &&
            !hasSeenBalanceWarning &&
            !showIOSPWAInstallModal &&
            !showAddMoneyPromptModal &&
            !isPostSignupActionModalVisible // ← ADD THIS
        ) {
            setShowBalanceWarningModal(true)
        }
    }
}, [balance, isFetchingBalance, showIOSPWAInstallModal, showAddMoneyPromptModal, isPostSignupActionModalVisible, user])
//                                                                                  ↑ ADD THIS
```

**Option 2: Delete Second Block**

Delete lines 170-191 entirely. Fix the dependency array in the first block:

```typescript
}, [balance, isFetchingBalance, showIOSPWAInstallModal, showAddMoneyPromptModal, isPostSignupActionModalVisible, user])
//                                                                                  ↑ ADD THIS
```

### Recommendation

**Use Option 1** - it's cleaner:

1. Delete lines 146-169
2. Add `!isPostSignupActionModalVisible` check on line 186
3. Add `isPostSignupActionModalVisible` to dependency array on line 191

### Risk Level

✅ **Very Low Risk**

- This is clearly a copy-paste error
- We're just removing duplicate code
- Keeping the more complete version
- No functional logic changes

### Testing

After fix, verify:

- [ ] Balance warning modal still shows when balance > $500
- [ ] Modal doesn't show if user already seen it
- [ ] Modal doesn't show if other modals are active
- [ ] No console errors or warnings

---

## Optional: Add Missing Modal Checks

While we're here, we could also add a few missing checks to prevent modal overlaps:

### 1. Balance Warning Should Check for Notifications Modal

Add `!showPermissionModal` check:

```typescript
if (
    balanceInUsd > BALANCE_WARNING_THRESHOLD &&
    !hasSeenBalanceWarning &&
    !showPermissionModal &&          // ← ADD THIS
    !showIOSPWAInstallModal &&
    !showAddMoneyPromptModal &&
    !isPostSignupActionModalVisible
)
```

And add to dependency array:

```typescript
}, [balance, isFetchingBalance, showPermissionModal, showIOSPWAInstallModal, showAddMoneyPromptModal, isPostSignupActionModalVisible, user])
```

**Risk:** Very Low (just adding more defensive checks)

### 2. iOS PWA Modal Should Check for Notifications Modal

In the iOS PWA effect (lines ~130-144), add `!showPermissionModal`:

```typescript
if (
    isIOS &&
    !isStandalone &&
    !hasSeenModalThisSession &&
    !user?.hasPwaInstalled &&
    !showPermissionModal &&          // ← ADD THIS
    !isPostSignupActionModalVisible &&
    !redirectUrl
)
```

**Risk:** Very Low

---

## Summary

### Must Do (Zero Risk):

- [x] Remove duplicate balance warning effect

### Nice to Have (Very Low Risk):

- [ ] Add `!showPermissionModal` check to balance warning
- [ ] Add `!showPermissionModal` check to iOS PWA modal

### Do Next Week (Medium Risk):

- [ ] Implement full modal manager (see MODAL_MANAGER_PR_PLAN.md)

---

## Implementation (Just the Duplicate Fix)

**Lines to delete:** 146-169 in `peanut-ui/src/app/(mobile-ui)/home/page.tsx`

**Lines to modify:** Around line 186 (after deletion, will be ~163)

Add this condition:

```typescript
!isPostSignupActionModalVisible &&
```

And update dependency array to include:

```typescript
isPostSignupActionModalVisible,
```

**Total lines changed:**

- Delete: 24 lines
- Modify: 2 lines
- **Net change:** -22 lines

**Time to implement:** 2 minutes  
**Time to test:** 5 minutes  
**Total time:** < 10 minutes
