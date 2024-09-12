# # Next.js Project Overview

The peanut-ui repository contains a Next.js application structured for scalability and maintainability. Below is a comprehensive overview of the directory structure, core functionality, and configuration details to help developers get up to speed quickly.

## Table of Contents

-   [# Next.js Project Overview](#-nextjs-project-overview)
    -   [Table of Contents](#table-of-contents)
    -   [Project Structure](#project-structure)
        -   [Next.js App Router](#nextjs-app-router)
            -   [Key Concepts:](#key-concepts)
        -   [Assets](#assets)
        -   [Configuration](#configuration)
        -   [Contexts](#contexts)
        -   [Hooks](#hooks)
    -   [Middleware](#middleware)
        -   [Key Highlights:](#key-highlights)
    -   [Tailwind Configuration](#tailwind-configuration)
    -   [How to Get Started](#how-to-get-started)

## Project Structure

### Next.js App Router

This Next.js application leverages the **App Router** introduced in Next.js 13, providing a more modular and file-based system for defining routes. The app structure is as follows:

-   **App Directory (`/app`)**: The core of the routing system, where all pages, layouts, and API routes are defined.

#### Key Concepts:

1. **Pages**:

    - Each file in the `/app` directory represents a route. Pages are defined by `page.tsx` files within specific folders.
    - For example, `/app/home/page.tsx` would serve the route `/home`.
    - The `page.tsx` file defines the front-end UI for that route.

2. **API Routes**:

    - API routes are located in the `/app/api` folder and follow the same structure. Instead of using `page.tsx`, API routes are defined with `route.ts` files.
    - For example, `/app/api/user/route.ts` defines the API endpoint for `/api/user`.
    - These routes are server-side and provide backend functionality within the same app.

3. **Nested Routing**:
    - The App Router allows for nested routes with shared layouts. This means multiple routes can share a common layout while having distinct page content.
    - This modular structure improves code organization and scalability.

This setup simplifies both front-end and back-end routing while providing flexibility to create nested, reusable layouts and API endpoints within the same directory. The new App Router enhances server-side rendering (SSR), static site generation (SSG), and hybrid rendering options, allowing for more efficient app development.

For more details on how the App Router works, you can refer to the official Next.js documentation [here](https://nextjs.org/docs/app/building-your-application/routing#the-app-router).

### Assets

All static assets such as images, logos, icons, and more are stored in the `/assets` folder. These assets can be easily imported throughout the application using:

```js
import * as assets from '/assets'

// Example usage:
;<img src={assets.peanutLogo} alt="Peanut Logo" />
```

This structure allows for a centralized asset management system and avoids the need to import assets individually from scattered files.

### Configuration

The `/config` folder holds all configuration-related files, such as:

-   **WAGMI**: Configuration for handling Web3 interactions.
-   **WalletConnect**: Configuration for setting up the WalletConnect provider.
-   **Google Analytics**: Set up for tracking user interactions.
-   **LogRocket**: Provides error and log tracking.
-   **Sentry**: Monitors and logs errors and performance issues.

This setup makes it easy to manage external services and configurations in a single, well-defined location.

### Contexts

There are three major contexts provided in the `/context` folder:

1. **Auth Context (`/context/auth`)**:

    - Handles user authentication, updating user details, adding additional accounts, and logging out.
    - Provides a custom hook for child components to easily interact with authentication functionality.
    - Allows child components to import and use:
        ```js
        const {
            user,
            setUser,
            updateBridgeCustomerId,
            fetchUser,
            updateUserName,
            submitProfilePhoto,
            addAccount,
            isFetchingUser,
            logoutUser,
        } = useAuthContext()
        ```

2. **TokenSelector Context (`/context/tokenselector`)**:

    - Manages the selected token and chain ID, handling token price fetching and denomination input.
    - Updates context values and resets the provider based on wallet connection status and user preferences.
    - Provides:
        ```js
        const {
            selectedTokenAddress,
            setSelectedTokenAddress,
            selectedChainID,
            setSelectedChainID,
            selectedTokenPrice,
            setSelectedTokenPrice,
            inputDenomination,
            setInputDenomination,
            refetchXchainRoute,
            setRefetchXchainRoute,
            resetTokenContextProvider,
        } = useTokenSelectorContext()
        ```

3. **LoadingState Context (`/context/loadingstate`)**:
    - Tracks the app's loading state and provides mechanisms to update it across the entire component tree.
    - It is used for managing loading states such as fetching data, processing transactions, and switching chains.
    - Provides:
        ```js
        const { loadingState, setLoadingState, isLoading } = useLoadingStateContext()
        ```

### Hooks

The `/hooks` folder contains two custom hooks to help manage wallet functionality:

1. **useBalance**:

    - Fetches and manages user wallet balances across multiple chains.
    - Converts API responses to a structured format and calculates total value per chain.
    - Usage:
        ```js
        const { balances, fetchBalances, valuePerChain, refetchBalances, hasFetchedBalances } = useBalance()
        ```

2. **useWalletType**:
    - Detects and manages the user's wallet type (e.g., Blockscout or Safe App environment).
    - Fetches environment and wallet info, then updates state based on the wallet address.
    - Usage:
        ```js
        const { walletType, environmentInfo, safeInfo } = useWalletType()
        ```

## Middleware

The middleware logic is defined in `middleware.ts`. It includes a promo link handler, redirection logic, and custom headers for API routes.

### Key Highlights:

-   **Promo Link Redirection**: Detects and redirects promo links.
-   **API Cache Control**: Ensures API routes are not cached by setting appropriate headers.

## Tailwind Configuration

The application uses TailwindCSS for styling. A custom configuration file `tailwind.config.ts` is provided, which includes predefined components for consistent design across the application. This configuration ensures that styles can be easily reused and adapted throughout the project.

## How to Get Started

To get started with the project, follow these steps:

1. **Clone the repository**:

    ```bash
    git clone https://github.com/peanutprotocol/peanut-ui
    cd peanut-ui
    ```

2. **Install dependencies**:

    ```bash
    pnpm install
    ```

3. **Run the development server**:

    ```bash
    pnpm run dev
    ```

4. **Access the application**: Open `http://localhost:3000` in your browser.

That's it! You are now ready to develop and extend the functionality of the app.
