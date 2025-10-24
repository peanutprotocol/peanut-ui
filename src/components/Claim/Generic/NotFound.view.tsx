'use client'

import ValidationErrorView from '@/components/Payment/Views/Error.validation.view'

export const NotFoundClaimLink = () => {
    return (
        <ValidationErrorView
            title="This link seems broken!"
            message="Are you sure you clicked on the right link? Was this link just created? Try again in a few seconds."
            buttonText="Go back to home"
            redirectTo="/home"
            showLearnMore={false}
        />
    )
}
