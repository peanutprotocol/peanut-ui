'use client'

import { useAuth } from '@/context/authContext'
import { Button } from '@/components/0_Bruddle/Button'

// inline peanut icon svg to ensure it works without needing to fetch external assets
const PeanutIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 291 389"
        fill="none"
        aria-label="Peanut Logo"
        className={className}
    >
        {/* peanut shape */}
        <path
            d="M60.3258 45.632C64.7897 43.0841 70.8696 42.4485 77.6753 42.1648L77.6751 42.1639C86.6738 41.7919 95.9563 42.9122 105.073 44.8494C131.211 50.4032 159.276 64.4612 173.241 88.947L173.241 88.948C182.385 105.004 187.299 122.974 187.679 140.59L187.68 140.615L187.681 140.639C188.214 158.799 197.656 175.377 213.007 185.103L213.027 185.115L213.048 185.129C227.987 194.435 240.944 207.825 250.088 223.88L250.089 223.881C264.205 248.652 262.114 279.714 253.648 304.817C253.251 305.963 252.866 307.057 252.469 308.126L252.46 308.151L252.45 308.178C252.436 308.216 252.422 308.255 252.408 308.294C252.395 308.33 252.381 308.367 252.367 308.403C246.631 323.792 238.741 335.81 232.382 341.201C232.326 341.246 232.276 341.285 232.239 341.315C232.158 341.378 232.121 341.409 232.087 341.434L232.052 341.462L232.017 341.489C231.506 341.893 231.256 342.093 231.002 342.275C230.703 342.487 230.41 342.68 230.129 342.856L229.759 343.068C226.058 345.176 218.929 346.766 209.112 346.794C199.522 346.822 188.125 345.356 176.457 342.08C153.35 335.592 130.193 322.32 117.448 300.794L116.849 299.762C107.705 283.706 102.79 265.736 102.41 248.12L102.409 248.096L102.409 248.072C101.876 229.912 92.433 213.335 77.0818 203.609L77.0617 203.595L77.0418 203.583L75.6472 202.699C61.7596 193.736 49.6638 181.222 40.8698 166.328L40.0013 164.831L39.4191 163.79C27.402 141.848 27.7929 115.163 33.9934 91.9808C37.1244 80.275 41.6741 69.7248 46.5873 61.491C51.6171 53.0618 56.6207 47.7423 60.3214 45.6342L60.3258 45.632Z"
            fill="#FFC900"
            stroke="black"
            strokeWidth="12.6195"
        />

        {/* eye lines */}
        <path d="M106.78 163.414L112.666 153.471" stroke="black" strokeWidth="8.41298" strokeLinecap="round" />

        {/* left eye */}
        <path
            d="M85.1709 145.907C98.5727 145.757 109.316 134.772 109.167 121.37C109.017 107.968 98.0318 97.2252 84.63 97.3746C71.2282 97.524 60.485 108.509 60.6344 121.911C60.7838 135.313 71.7691 146.056 85.1709 145.907Z"
            fill="white"
            stroke="black"
            strokeWidth="8.41298"
        />

        {/* right eye */}
        <path
            d="M127.511 122.531C140.913 122.382 151.656 111.396 151.507 97.9945C151.357 84.5927 140.372 73.8495 126.97 73.9989C113.569 74.1482 102.825 85.1336 102.975 98.5354C103.124 111.937 114.109 122.68 127.511 122.531Z"
            fill="white"
            stroke="black"
            strokeWidth="8.41298"
        />

        {/* right pupil */}
        <path
            d="M124.817 75.0371C119.025 82.8635 118.786 93.8654 124.943 102.046C130.198 109.028 138.726 112.102 146.794 110.725C152.587 102.898 152.825 91.8966 146.669 83.7158C141.413 76.7341 132.886 73.66 124.817 75.0371Z"
            fill="black"
        />

        {/* left pupil */}
        <path
            d="M83.7629 98.3403C78.1936 106.086 78.0308 116.853 84.0684 124.879C89.0469 131.494 96.9795 134.564 104.643 133.65C110.213 125.904 110.376 115.137 104.338 107.111C99.3594 100.497 91.4268 97.426 83.7629 98.3403Z"
            fill="black"
        />

        {/* smile */}
        <path
            d="M114.128 159.598C119.673 161.038 126.095 160.674 131.417 158.723C136.777 156.752 143.396 151.325 146.285 146.32"
            stroke="black"
            strokeWidth="8.41298"
            strokeLinecap="round"
        />
    </svg>
)

/**
 * full-page error screen shown when backend requests fail after retries
 * displays peanut logo and options to retry or log out
 */
export default function BackendErrorScreen() {
    const { logoutUser, isLoggingOut } = useAuth()

    const handleRetry = () => {
        window.location.reload()
    }

    const handleForceLogout = () => {
        // Use skipBackendCall since backend is likely down (that's why we're on this screen)
        logoutUser({ skipBackendCall: true })
    }

    return (
        <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-6 bg-background p-6">
            <div className="h-32 w-32 opacity-50 grayscale">
                <PeanutIcon className="h-full w-full" />
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold text-gray-800">Something went wrong</h1>
                <p className="max-w-md text-sm text-gray-600">We&apos;re having trouble connecting to our servers.</p>
            </div>
            <div className="flex flex-col items-center gap-6">
                <Button shadowSize="4" icon="retry" size="medium" className="w-fit rounded-full" onClick={handleRetry}>
                    Try Again
                </Button>
                <button
                    onClick={handleForceLogout}
                    disabled={isLoggingOut}
                    className="text-sm text-gray-600 underline hover:text-gray-800 disabled:opacity-50"
                >
                    {isLoggingOut ? 'Logging out...' : 'Log out'}
                </button>
            </div>
        </div>
    )
}
