'use client'
import { useColorModeValue } from '@chakra-ui/color-mode'
import { Box } from '@chakra-ui/layout'
import { Button, Flex, Heading } from '@chakra-ui/react'
import { Step, Steps, useSteps } from 'chakra-ui-steps'

const steps = [
    { label: 'Step 1: fill out personal information' },
    { label: 'Step 2: agree to TOS' },
    { label: 'Step 3: Complete KYC' },
    { label: 'Step 4: Submit Account Number' },
    { label: 'Step 5: Confirm' },
]

const comp1 = <></>

export const Vertical = ({ variant = 'circles' }: { variant?: 'circles' | 'circles-alt' | 'simple' | undefined }) => {
    const { nextStep, prevStep, reset, activeStep } = useSteps({
        initialStep: 0,
    })
    const isLastStep = activeStep === steps.length - 1
    const hasCompletedAllSteps = activeStep === steps.length

    return (
        <Flex flexDir="column" width="100%">
            <Steps variant={variant} orientation="vertical" colorScheme="blue" activeStep={activeStep}>
                {steps.map(({ label }, index) => (
                    <Step label={label} key={label}>
                        ...
                    </Step>
                ))}
            </Steps>
            <Flex width="100%" justify="flex-end" gap={4}>
                {hasCompletedAllSteps ? (
                    <Button size="sm" onClick={reset}>
                        Reset
                    </Button>
                ) : (
                    <>
                        <Button isDisabled={activeStep === 0} onClick={prevStep} size="sm" variant="ghost">
                            Prev
                        </Button>
                        <Button size="sm" onClick={nextStep}>
                            {isLastStep ? 'Finish' : 'Next'}
                        </Button>
                    </>
                )}
            </Flex>
        </Flex>
    )
}
