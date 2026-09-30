import { useState } from 'react'
import { useForm } from 'react-hook-form'
import ConceptPageLayout from '@/components/form-primitives/ConceptPageLayout'
import FormField from '@/components/form-primitives/FormField'
import SubmitButton from '@/components/form-primitives/SubmitButton'
import styles from './RhfBasicsPage.module.css'

function RhfBasicsPage() {
    const [submittedData, setSubmittedData] = useState(null)
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        defaultValues: {
            name: 'Sujay',
            email: '',
            role: 'Frontend developer',
        },
    })

    async function onSubmit(data) {
        await new Promise((resolve) => window.setTimeout(resolve, 600))
        setSubmittedData(data)
    }

    return (
        <ConceptPageLayout
            title="RHF Basics"
            description="Connect native form inputs with register(), start with useful default values, and read validation feedback from formState.errors."
            tags={['useForm', 'register', 'defaultValues', 'formState.errors']}
            notes="defaultValues populates the initial form state. Try submitting before entering an email to see errors.email appear."
        >
            <form
                className={styles.form}
                noValidate
                onSubmit={handleSubmit(onSubmit)}
            >
                <FormField id="name" label="Name" error={errors.name?.message}>
                    <input
                        id="name"
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={
                            errors.name ? 'name-error' : undefined
                        }
                        {...register('name', {
                            required: 'Please enter your name.',
                        })}
                    />
                </FormField>
                <FormField
                    id="email"
                    label="Email"
                    error={errors.email?.message}
                >
                    <input
                        id="email"
                        type="email"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={
                            errors.email ? 'email-error' : undefined
                        }
                        {...register('email', {
                            required: 'Please enter your email address.',
                        })}
                    />
                </FormField>
                <FormField
                    id="role"
                    label="Role"
                    hint="This field starts with a default value."
                >
                    <input id="role" {...register('role')} />
                </FormField>
                <SubmitButton isSubmitting={isSubmitting}>
                    Save profile
                </SubmitButton>
            </form>
            {submittedData && (
                <p className={styles.success} role="status">
                    Saved profile for {submittedData.name}.
                </p>
            )}
        </ConceptPageLayout>
    )
}

export default RhfBasicsPage
