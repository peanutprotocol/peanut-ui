interface RequirementLabelInfo {
    title: string
    description: string
}

// map of bridge additional_requirements to user-friendly labels
const BRIDGE_REQUIREMENT_LABELS: Record<string, RequirementLabelInfo> = {
    proof_of_address: {
        title: 'Proof of Address',
        description:
            'Upload a utility bill, bank statement, or government letter showing your current address (dated within 3 months).',
    },
    additional_identity_document: {
        title: 'Additional Identity Document',
        description: 'Upload an additional government-issued ID document.',
    },
    proof_of_source_of_funds: {
        title: 'Proof of Source of Funds',
        description: 'Upload documentation showing the origin of your funds (e.g. pay stub, tax return).',
    },
    proof_of_tax_identification: {
        title: 'Tax Identification',
        description: 'Upload a document showing your tax identification number.',
    },
}

const FALLBACK_LABEL: RequirementLabelInfo = {
    title: 'Additional Document',
    description: 'Please provide the requested document.',
}

/** get human-readable label for a bridge additional requirement */
export function getRequirementLabel(requirement: string): RequirementLabelInfo {
    return (
        BRIDGE_REQUIREMENT_LABELS[requirement] ?? {
            // auto-format unknown requirement codes as title case
            title: requirement.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            description: FALLBACK_LABEL.description,
        }
    )
}
