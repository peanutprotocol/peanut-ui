# Modal Manager Implementation Plan

**Status:** Planned for post-release  
**Risk Level:** Medium-High (requires testing across all user flows)  
**Estimated Time:** 4-6 hours implementation + 2-3 hours testing

---

## Overview

This PR will implement a centralized modal manager to coordinate which modal shows at any given time, preventing multiple modals from overlapping.

---

## Changes Summary

### 1. New File: `src/hooks/useModalManager.ts` (155 lines)

Create a global modal registry that coordinates modal visibility based on priority.

**Key Features:**

- Priority-based modal queue (higher priority modals show first)
- Global state shared across all hook instances
- Two hooks: `useModalManager` (for self-managed modals) and `useModalVisibility` (for parent-managed modals)

**Priority Order:**

```typescript
export enum ModalPriority {
    EARLY_USER = 100, // Highest priority
    NO_MORE_JAIL = 90,
    POST_SIGNUP_ACTION = 80,
    NOTIFICATIONS = 70,
    IOS_PWA_INSTALL = 60,
    BALANCE_WARNING = 50,
    ADD_MONEY_PROMPT = 40, // Lowest priority
}
```

**Full Implementation:** See code at end of this document

---

### 2. Integrate with Self-Managed Modals

#### 2a. `EarlyUserModal/index.tsx` (9 line changes)

**Changes:**

1. Import modal manager
2. Replace `showModal` state with `wantsToShow` state
3. Use `useModalManager` hook to get `shouldShow`
4. Register/unregister based on conditions
5. Update `visible` prop to use `shouldShow`

**Key Lines:**

```typescript
import { useModalManager, ModalPriority } from '@/hooks/useModalManager'

const { shouldShow, registerModal, unregisterModal } = useModalManager('early-user', ModalPriority.EARLY_USER)

useEffect(() => {
    if (user && user.showEarlyUserModal) {
        setWantsToShow(true)
        registerModal()
    } else {
        setWantsToShow(false)
        unregisterModal()
    }
}, [user, registerModal, unregisterModal])

// In modal component:
visible={shouldShow}
onClose={() => { unregisterModal(); /* ...existing logic... */ }}
```

#### 2b. `NoMoreJailModal/index.tsx` (11 line changes)

Similar pattern to EarlyUserModal:

- Import modal manager
- Replace `isOpen` with `wantsToShow`
- Use `shouldShow` from modal manager
- Register/unregister based on sessionStorage

#### 2c. `PostSignupActionManager/index.tsx` (20 line changes)

Similar pattern:

- Import modal manager
- Replace `showModal` with `wantsToShow`
- Use `shouldShow` from modal manager
- Register when KYC approved + redirect exists
- Unregister on close or when conditions not met
- Update visibility callback to use `shouldShow`

---

### 3. Integrate with Notifications Hook

#### `hooks/useNotifications.ts` (20 line changes)

**Changes:**

1. Import modal manager
2. Rename internal state `showPermissionModal` → `wantsToShowPermissionModal`
3. Use modal manager to get actual `showPermissionModal` (returned to consumers)
4. Call `registerModal()` when wanting to show, `unregisterModal()` when not
5. Update all internal references to use `setWantsToShowPermissionModal`

**Key Lines:**

```typescript
import { useModalManager, ModalPriority } from './useModalManager'

const [wantsToShowPermissionModal, setWantsToShowPermissionModal] = useState(false)
const {
    shouldShow: showPermissionModal,
    registerModal,
    unregisterModal,
} = useModalManager('notifications', ModalPriority.NOTIFICATIONS)

// In evaluateVisibility:
if (granted) {
    setWantsToShowPermissionModal(false)
    unregisterModal()
    // ...
}

if (!modalClosed) {
    setWantsToShowPermissionModal(true)
    registerModal()
    // ...
}
```

**This maintains backward compatibility** - consumers still get `showPermissionModal` from the hook.

---

### 4. Integrate with Parent-Managed Modals (Home Page)

#### `app/(mobile-ui)/home/page.tsx` (40 line changes)

**Changes:**

1. Import `useModalVisibility` and `ModalPriority`
2. Add modal manager integration for each modal:
    ```typescript
    const canShowIOSPWA = useModalVisibility('ios-pwa-install', ModalPriority.IOS_PWA_INSTALL, showIOSPWAInstallModal)
    const canShowBalanceWarning = useModalVisibility(
        'balance-warning',
        ModalPriority.BALANCE_WARNING,
        showBalanceWarningModal
    )
    const canShowAddMoney = useModalVisibility(
        'add-money-prompt',
        ModalPriority.ADD_MONEY_PROMPT,
        showAddMoneyPromptModal
    )
    ```
3. **Simplify useEffect blocks** - remove all cross-modal checks:

    ```typescript
    // Before: checks 6+ other modal states
    if (
        balanceInUsd > BALANCE_WARNING_THRESHOLD &&
        !hasSeenBalanceWarning &&
        !showIOSPWAInstallModal &&
        !showAddMoneyPromptModal &&
        !isPostSignupActionModalVisible &&
        !showPermissionModal
    )

    // After: only check local conditions
    if (balanceInUsd > BALANCE_WARNING_THRESHOLD && !hasSeenBalanceWarning)
    ```

4. Update modal `visible` props to use `canShow*` instead of `show*`
5. Remove race condition handler in Add Money modal effect

**Benefits:**

- Cleaner, more maintainable code
- Each modal only worries about its own conditions
- Modal manager handles priority coordination
- Remove ~50 lines of duplicate condition checks

---

### 5. Remove Duplicate Balance Warning Effect

**CRITICAL BUG FIX** (included in this PR):

Delete duplicate useEffect block at lines 146-168 in `home/page.tsx`. Keep only the second one (lines 170-191) which has more complete dependency array.

---

## Testing Requirements

### Unit Tests Needed

1. **Modal Manager Tests:**
    - Single modal registration works
    - Multiple modals respect priority
    - Unregister removes modal from queue
    - Next modal shows when highest priority closes

2. **Integration Tests:**
    - Each modal still shows under correct conditions
    - Only one modal visible at a time
    - Modal callbacks still work (DB updates, sessionStorage, etc.)
    - Closing modal shows next priority modal

### Manual Testing Scenarios

1. **Early User + Zero Balance + No Notifications:**
    - Should show Early User modal ONLY
    - After closing, should show Notifications modal
    - After closing that, should show Add Money modal

2. **No More Jail + Notifications:**
    - Should show No More Jail modal ONLY
    - After closing, should show Notifications modal

3. **High Balance + No Notifications:**
    - Should show Notifications modal first (higher priority)
    - After closing, should show Balance Warning modal

4. **Post-KYC Redirect:**
    - Post-signup modal should show first (high priority)
    - Other modals should wait

5. **iOS PWA Install:**
    - Should respect priority (below notifications, above balance warning)

### Regression Testing

- [ ] Notifications still subscribe users correctly
- [ ] Early User modal still updates DB (`hasSeenEarlyUserModal`)
- [ ] No More Jail modal still clears sessionStorage
- [ ] Post-signup modal still redirects correctly
- [ ] Add Money modal still marks session as seen
- [ ] Balance warning still saves to localStorage
- [ ] All modal close buttons work
- [ ] All modal "Don't show again" logic works

---

## Rollback Plan

If issues arise:

1. Revert hook imports in all modal files
2. Restore original state variable names
3. Restore original condition checks in home page
4. Remove `useModalManager.ts` file

All original functionality is preserved within each component, just coordinated differently.

---

## Implementation Order

1. ✅ Create `useModalManager.ts` hook
2. ✅ Test hook in isolation with dummy modals
3. Integrate one modal at a time:
    - Start with lowest impact (Add Money)
    - Then Balance Warning
    - Then iOS PWA
    - Then Notifications (most complex)
    - Finally self-managed modals
4. Test each integration before moving to next
5. Full integration testing
6. QA review

---

## Code: useModalManager.ts

````typescript
'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Modal priority levels (higher = higher priority)
 * When multiple modals want to show, only the highest priority one will be visible
 */
export enum ModalPriority {
    EARLY_USER = 100,
    NO_MORE_JAIL = 90,
    POST_SIGNUP_ACTION = 80,
    NOTIFICATIONS = 70,
    IOS_PWA_INSTALL = 60,
    BALANCE_WARNING = 50,
    ADD_MONEY_PROMPT = 40,
}

export type ModalId =
    | 'early-user'
    | 'no-more-jail'
    | 'post-signup-action'
    | 'notifications'
    | 'ios-pwa-install'
    | 'balance-warning'
    | 'add-money-prompt'

interface ModalRegistration {
    id: ModalId
    priority: ModalPriority
    wantsToShow: boolean
}

/**
 * Global modal registry - shared across all instances of the hook
 * This ensures modal coordination even if multiple components use the hook
 */
const modalRegistry = new Map<ModalId, ModalRegistration>()
const listeners = new Set<() => void>()

function notifyListeners() {
    listeners.forEach((listener) => listener())
}

/**
 * Centralized modal manager that coordinates which modal should be visible
 * When multiple modals want to show, only the highest priority one is displayed
 *
 * Usage:
 * ```typescript
 * const { shouldShow, registerModal, unregisterModal } = useModalManager('notifications', ModalPriority.NOTIFICATIONS)
 *
 * useEffect(() => {
 *   if (myConditionsToShow) {
 *     registerModal()
 *   } else {
 *     unregisterModal()
 *   }
 * }, [myConditionsToShow])
 *
 * return <Modal visible={shouldShow} ... />
 * ```
 */
export function useModalManager(modalId: ModalId, priority: ModalPriority) {
    const [, forceUpdate] = useState({})

    // Subscribe to registry changes
    useEffect(() => {
        const listener = () => forceUpdate({})
        listeners.add(listener)
        return () => {
            listeners.delete(listener)
        }
    }, [])

    // Register modal when it wants to show
    const registerModal = useCallback(() => {
        modalRegistry.set(modalId, {
            id: modalId,
            priority,
            wantsToShow: true,
        })
        notifyListeners()
    }, [modalId, priority])

    // Unregister modal when it doesn't want to show
    const unregisterModal = useCallback(() => {
        modalRegistry.set(modalId, {
            id: modalId,
            priority,
            wantsToShow: false,
        })
        notifyListeners()
    }, [modalId, priority])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            modalRegistry.delete(modalId)
            notifyListeners()
        }
    }, [modalId])

    // Determine if this modal should be visible
    const shouldShow = useCallback(() => {
        const registration = modalRegistry.get(modalId)
        if (!registration || !registration.wantsToShow) {
            return false
        }

        // Find highest priority modal that wants to show
        let highestPriority = -1
        let highestPriorityId: ModalId | null = null

        modalRegistry.forEach((reg) => {
            if (reg.wantsToShow && reg.priority > highestPriority) {
                highestPriority = reg.priority
                highestPriorityId = reg.id
            }
        })

        // Only show if this modal has the highest priority
        return highestPriorityId === modalId
    }, [modalId])

    return {
        shouldShow: shouldShow(),
        registerModal,
        unregisterModal,
    }
}

/**
 * Helper hook for modals managed by parent component state
 * This wraps the modal manager for easier integration with existing state-based modals
 *
 * Usage:
 * ```typescript
 * const canShow = useModalVisibility('balance-warning', ModalPriority.BALANCE_WARNING, wantsToShow)
 * return <Modal visible={canShow && showModal} ... />
 * ```
 */
export function useModalVisibility(modalId: ModalId, priority: ModalPriority, wantsToShow: boolean): boolean {
    const { shouldShow, registerModal, unregisterModal } = useModalManager(modalId, priority)

    useEffect(() => {
        if (wantsToShow) {
            registerModal()
        } else {
            unregisterModal()
        }
    }, [wantsToShow, registerModal, unregisterModal])

    return shouldShow
}
````

---

## Benefits of This Approach

1. **Maintains All Existing Functionality:**
    - All modal callbacks preserved
    - All DB updates/side effects unchanged
    - All existing conditions still apply

2. **Minimal Breaking Changes:**
    - APIs remain mostly the same
    - Consumers of `useNotifications` see no change
    - Modal components keep same props

3. **Easy to Rollback:**
    - Original logic still in place
    - Just remove coordination layer

4. **Prevents All Current Issues:**
    - No more overlapping modals
    - Clear priority order
    - Easy to debug (check modal registry)

5. **Maintainable:**
    - Add new modals by registering with priority
    - Change priority by updating enum
    - Debug with console.log(modalRegistry)

---

## Questions/Decisions Needed

1. **Should banners (notification banner) also be coordinated?**
    - Currently only modals are managed
    - Banners might conflict with modals

2. **What if two modals have same priority?**
    - Current: first registered wins
    - Could: add tiebreaker (timestamp, alphabetical ID)

3. **Should we show modals in sequence or one-at-a-time?**
    - Current: one at a time, next shows when current closes
    - Alternative: queue and show all in sequence automatically

4. **Dev tools for debugging?**
    - Could add a debug panel showing modal queue
    - Could add console logging in dev mode
