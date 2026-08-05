import { type FC, type SVGProps } from 'react'

// brand marks for the app-store CTAs (pwa-sunset migration surfaces).
// monochrome (currentColor) so they follow button text color like Lucide icons.

export const AppleLogoIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path
            d="M17.05 12.536c-.026-2.615 2.135-3.87 2.233-3.932-1.216-1.779-3.107-2.022-3.779-2.05-1.608-.163-3.14.947-3.956.947-.815 0-2.076-.923-3.413-.898-1.756.026-3.376 1.021-4.28 2.594-1.826 3.166-.466 7.854 1.312 10.423.87 1.258 1.906 2.671 3.266 2.62 1.311-.052 1.806-.848 3.391-.848 1.585 0 2.03.848 3.417.822 1.412-.026 2.305-1.283 3.166-2.546.999-1.459 1.41-2.872 1.434-2.945-.031-.014-2.752-1.055-2.79-4.187zM14.44 4.859c.723-.876 1.21-2.093 1.077-3.306-1.04.042-2.301.693-3.048 1.568-.67.776-1.256 2.015-1.098 3.204 1.16.09 2.345-.59 3.069-1.466z"
            fill="currentColor"
        />
    </svg>
)

export const GooglePlayIcon: FC<SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path
            d="M3.61 1.814L13.79 12 3.61 22.186a1.99 1.99 0 01-.61-1.437V3.25c0-.564.234-1.073.61-1.436zm11.24 11.246l2.577 2.578-11.29 6.42c-.522.297-1.122.33-1.653.117l10.366-9.115zm3.723-4.55l3.31 1.882c1.155.657 1.155 2.36 0 3.017l-3.31 1.882L15.91 12.6l2.663-2.09zm-14.09-7.03c.532-.213 1.132-.18 1.654.117l11.29 6.42-2.577 2.578L4.483 1.48z"
            fill="currentColor"
        />
    </svg>
)
