import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import ConceptPageLayout from '@/components/form-primitives/ConceptPageLayout'
import FormField from '@/components/form-primitives/FormField'
import SubmitButton from '@/components/form-primitives/SubmitButton'
import styles from './RhfZodIntegrationPage.module.css'

const registrationSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter at least 2 characters for your name.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Use at least 8 characters for your password.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords must match.',
    path: ['confirmPassword'],
  })

function RhfZodIntegrationPage() {
  const [submittedData, setSubmittedData] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registrationSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(data) {
    await new Promise((resolve) => window.setTimeout(resolve, 600))
    setSubmittedData(data)
  }

  return (
    <ConceptPageLayout
      title="Zod + React Hook Form"
      description="Move validation rules into a Zod schema, then let zodResolver expose its messages through the same RHF errors object."
      tags={['zodResolver', 'z.object', 'z.string', 'refine']}
      notes="Unlike the native-RHF validation example, register() has no validation options here; the schema owns those rules."
    >
      <form className={styles.form} noValidate onSubmit={handleSubmit(onSubmit)}>
        <FormField id="name" label="Name" error={errors.name?.message}>
          <input id="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} {...register('name')} />
        </FormField>
        <FormField id="email" label="Email" error={errors.email?.message}>
          <input id="email" type="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />
        </FormField>
        <FormField id="password" label="Password" error={errors.password?.message}>
          <input id="password" type="password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} {...register('password')} />
        </FormField>
        <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
          <input id="confirmPassword" type="password" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined} {...register('confirmPassword')} />
        </FormField>
        <SubmitButton isSubmitting={isSubmitting}>Create account</SubmitButton>
      </form>
      {submittedData && <p className={styles.success} role="status">Schema validation passed for {submittedData.name}.</p>}
    </ConceptPageLayout>
  )
}

export default RhfZodIntegrationPage
