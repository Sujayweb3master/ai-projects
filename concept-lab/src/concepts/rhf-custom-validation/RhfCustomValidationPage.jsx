import { useState } from 'react'
import { useForm } from 'react-hook-form'
import ConceptPageLayout from '@/components/form-primitives/ConceptPageLayout'
import FormField from '@/components/form-primitives/FormField'
import SubmitButton from '@/components/form-primitives/SubmitButton'
import styles from './RhfCustomValidationPage.module.css'

function RhfCustomValidationPage() {
  const [submittedData, setSubmittedData] = useState(null)
  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  async function onSubmit(data) {
    await new Promise((resolve) => window.setTimeout(resolve, 600))
    setSubmittedData(data)
  }

  return (
    <ConceptPageLayout
      title="Custom Validation"
      description="Use validate when a rule is unique to your app or needs to compare one field with another."
      tags={['validate', 'getValues', 'cross-field validation']}
      notes="The confirmation rule reads password with getValues(), while inviteCode shows the object-of-functions validate form."
    >
      <form className={styles.form} noValidate onSubmit={handleSubmit(onSubmit)}>
        <FormField id="password" label="Password" error={errors.password?.message}>
          <input id="password" type="password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} {...register('password', {
            required: 'Create a password.',
            validate: (value) => value.length >= 8 || 'Use at least 8 characters.',
          })} />
        </FormField>
        <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
          <input id="confirmPassword" type="password" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined} {...register('confirmPassword', {
            validate: (value) => value === getValues('password') || 'Passwords must match.',
          })} />
        </FormField>
        <FormField id="inviteCode" label="Invite code" hint="Try LAB-2026 for a valid code." error={errors.inviteCode?.message}>
          <input id="inviteCode" aria-invalid={Boolean(errors.inviteCode)} aria-describedby={errors.inviteCode ? 'inviteCode-error' : undefined} {...register('inviteCode', {
            validate: {
              present: (value) => Boolean(value) || 'An invite code is required.',
              knownCode: (value) => value === 'LAB-2026' || 'That invite code is not recognized.',
            },
          })} />
        </FormField>
        <SubmitButton isSubmitting={isSubmitting}>Join workspace</SubmitButton>
      </form>
      {submittedData && <p className={styles.success} role="status">Account settings saved with invite code {submittedData.inviteCode}.</p>}
    </ConceptPageLayout>
  )
}

export default RhfCustomValidationPage
