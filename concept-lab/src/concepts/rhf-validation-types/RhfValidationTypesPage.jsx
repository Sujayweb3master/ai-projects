import { useState } from 'react'
import { useForm } from 'react-hook-form'
import ConceptPageLayout from '@/components/form-primitives/ConceptPageLayout'
import FormField from '@/components/form-primitives/FormField'
import SubmitButton from '@/components/form-primitives/SubmitButton'
import styles from './RhfValidationTypesPage.module.css'

function RhfValidationTypesPage() {
  const [submittedData, setSubmittedData] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  async function onSubmit(data) {
    await new Promise((resolve) => window.setTimeout(resolve, 600))
    setSubmittedData(data)
  }

  return (
    <ConceptPageLayout
      title="Validation Types"
      description="Each field uses a different built-in rule, keeping common validation close to the input it protects."
      tags={['required', 'minLength', 'maxLength', 'min', 'max', 'pattern']}
    >
      <form className={styles.form} noValidate onSubmit={handleSubmit(onSubmit)}>
        <FormField id="username" label="Username" hint="3–12 letters, numbers, or underscores." error={errors.username?.message}>
          <input id="username" aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'username-error' : undefined} {...register('username', {
            required: 'A username is required.',
            minLength: { value: 3, message: 'Use at least 3 characters.' },
            maxLength: { value: 12, message: 'Use no more than 12 characters.' },
            pattern: { value: /^[A-Za-z0-9_]+$/, message: 'Use letters, numbers, or underscores only.' },
          })} />
        </FormField>
        <FormField id="age" label="Age" hint="Choose a number from 18 through 120." error={errors.age?.message}>
          <input id="age" type="number" aria-invalid={Boolean(errors.age)} aria-describedby={errors.age ? 'age-error' : undefined} {...register('age', {
            required: 'Age is required.',
            valueAsNumber: true,
            min: { value: 18, message: 'You must be at least 18.' },
            max: { value: 120, message: 'Enter a realistic age.' },
          })} />
        </FormField>
        <FormField id="email" label="Work email" error={errors.email?.message}>
          <input id="email" type="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email', {
            required: 'A work email is required.',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
          })} />
        </FormField>
        <SubmitButton isSubmitting={isSubmitting}>Create account</SubmitButton>
      </form>
      {submittedData && <p className={styles.success} role="status">Validation passed for {submittedData.username}.</p>}
    </ConceptPageLayout>
  )
}

export default RhfValidationTypesPage
