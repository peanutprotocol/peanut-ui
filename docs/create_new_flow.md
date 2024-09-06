# SOP: Creating New Visual Flows in peanut-ui

## Purpose

This document outlines the steps for creating a new visual flow with multiple screens in the peanut-ui. The goal is to ensure consistency in implementing new flows, including parent components, multiple views, navigation logic, and screen state management.

---

## Folder Structure

Each new flow consists of a parent component, a folder for view components, a constants file to manage the flow, and TypeScript definitions for props and screen types.

The general structure:

```
/components
  /[FlowName]
    /Views
      - Initial.view.tsx
      - Success.view.tsx
    - [FlowName].tsx
    - [FlowName].consts.ts
    - index.ts
```

---

## Step-by-Step Process

### 1. **Create the Folder Structure**

Create a new folder inside the `/components` directory for the new flow. This folder should mirror the structure shown in the existing `Create` flow, with the following subdirectories and files:

-   **Views Folder**: This will contain the individual screens of the flow.
-   **Parent Component**: This will manage the navigation between screens and hold the flow's state.
-   **Constants File**: This will define the screens, flow, and screen mapping.

For example, to create a new flow called `NewFlow`:

```
/components
  /NewFlow
    /Views
      - Initial.view.tsx
      - Success.view.tsx
      - ...
    - NewFlow.tsx
    - NewFlow.consts.ts
    - index.ts
```

### 2. **Define Constants**

In the `[FlowName].consts.ts` file, define the screen flow, state, and mappings similar to how it is done in the `Create.consts.ts` file.

Example for `NewFlow.consts.ts`:

```ts
import * as views from './Views'

export type NewFlowScreens = 'INITIAL' | 'SUCCESS'

export interface INewFlowScreenState {
    screen: NewFlowScreens
    idx: number
}

export const INIT_NEW_FLOW_VIEW_STATE: INewFlowScreenState = {
    screen: 'INITIAL',
    idx: 0,
}

export const NEW_FLOW_SCREEN_FLOW: NewFlowScreens[] = ['INITIAL', 'SUCCESS']

export const NEW_FLOW_SCREEN_MAP: { [key in NewFlowScreens]: { comp: React.FC<any> } } = {
    INITIAL: { comp: views.InitialView },
    SUCCESS: { comp: views.SuccessView },
}

export interface INewFlowScreenProps {
    onNext: () => void
    onPrev: () => void
    link: string
    setLink: (value: string) => void
    // Add other props as needed
}
```

### 3. **Create Views**

Create the individual screens (views) for your new flow inside the `/Views` folder. Each screen should be a `.tsx` file and should receive the props necessary for navigation and state updates.

For example, `Initial.view.tsx` might look like:

```tsx
import React from 'react'
import * as _consts from '../NewFlow.consts'
export const InitialView = ({ onNext, link, setLink }: _consts.INewFlowScreenProps) => {
    return (
        <div>
            <h1>Initial View</h1>
            {/* Add UI elements for the initial screen */}
            <button onClick={onNext}>Next</button>
        </div>
    )
}
```

Ensure each view component corresponds with the screen flow defined in the constants file.

### 4. **Create Parent Component**

Create the parent component that will manage the flow between screens. This component will hold the state and navigation logic (next, previous steps) and pass relevant props to the screen components.

Example for `NewFlow.tsx`:

```tsx
'use client'

import { createElement, useEffect, useState } from 'react'
import * as _consts from './NewFlow.consts'
import { useAccount } from 'wagmi'

export const NewFlowComponent = () => {
    const [step, setStep] = useState<_consts.INewFlowScreenState>(_consts.INIT_NEW_FLOW_VIEW_STATE)
    const [link, setLink] = useState<string>('')

    const handleOnNext = () => {
        if (step.idx === _consts.NEW_FLOW_SCREEN_FLOW.length - 1) return
        const newIdx = step.idx + 1
        setStep({
            screen: _consts.NEW_FLOW_SCREEN_FLOW[newIdx],
            idx: newIdx,
        })
    }

    const handleOnPrev = () => {
        if (step.idx === 0) return
        const newIdx = step.idx - 1
        setStep({
            screen: _consts.NEW_FLOW_SCREEN_FLOW[newIdx],
            idx: newIdx,
        })
    }

    return (
        <div className="card">
            {createElement(_consts.NEW_FLOW_SCREEN_MAP[step.screen].comp, {
                onNext: handleOnNext,
                onPrev: handleOnPrev,
                link,
                setLink,
            })}
        </div>
    )
}
```

### 5. **Index File**

The `index.ts` file should export the parent component of the new flow to make it available for import.

```ts
export { NewFlowComponent } from './NewFlow'
```

### 6. **Test the Flow**

1. **Import the Component**: Import the new flow component in your application where necessary.

    ```ts
    import { NewFlowComponent } from '@/components/NewFlow'
    ```

2. **Run the App**: Ensure that each screen is functioning properly and that the navigation between steps is correct.
3. **Test Edge Cases**: Verify behavior at the beginning and end of the flow, such as disabling the "Previous" button on the first screen and the "Next" button on the last screen.

---

## Best Practices

-   **Consistent Naming**: Follow the established naming conventions for files, types, and states.
-   **Modular Views**: Keep each view screen modular, focusing only on the specific UI and functionality of that screen.
-   **Prop Validation**: Ensure all props passed to screens are typed correctly using TypeScript interfaces.
-   **Component Reusability**: Consider reusability of components across different flows when applicable.

---

## Troubleshooting

-   **Missing Props**: If a component fails to render, check if all required props are being passed correctly from the parent component.
-   **Navigation Issues**: Ensure that the `CREATE_SCREEN_FLOW` or equivalent flow is correctly updated in the constants file and that the index manipulation logic works as intended.
