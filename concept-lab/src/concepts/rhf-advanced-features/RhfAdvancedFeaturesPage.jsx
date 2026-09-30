import { useState } from 'react'
import { useController, useFieldArray, useForm, useWatch } from 'react-hook-form'
import ConceptPageLayout from '@/components/form-primitives/ConceptPageLayout'
import FormField from '@/components/form-primitives/FormField'
import SubmitButton from '@/components/form-primitives/SubmitButton'
import styles from './RhfAdvancedFeaturesPage.module.css'

function PriorityPicker({ control }) {
  const { field } = useController({ control, name: 'priority' })
  const priorities = ['Low', 'Medium', 'High']

  return (
    <div className={styles.priorityPicker} role="radiogroup" aria-label="Priority">
      {priorities.map((priority) => (
        <button
          className={field.value === priority ? styles.priorityActive : styles.priorityButton}
          type="button"
          role="radio"
          aria-checked={field.value === priority}
          key={priority}
          onClick={() => field.onChange(priority)}
        >
          {priority}
        </button>
      ))}
    </div>
  )
}

function RhfAdvancedFeaturesPage() {
  const [submittedData, setSubmittedData] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const {
    control,
    register,
    getValues,
    handleSubmit,
    reset,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      title: '',
      priority: 'Medium',
      sendUpdates: false,
      updateEmail: '',
      teammates: [{ name: '' }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'teammates' })
  const sendsUpdates = watch('sendUpdates')
  const title = useWatch({ control, name: 'title' })

  async function onSubmit(data) {
    await new Promise((resolve) => window.setTimeout(resolve, 600))
    setSubmittedData(data)
  }

  async function validateTitle() {
    await trigger('title')
  }

  return (
    <ConceptPageLayout
      title="Lesser-Known RHF Tools"
      description="Combine RHF’s observation, dynamic-field, controlled-input, and imperative APIs in one deliberately small project form."
      tags={['watch', 'useWatch', 'useFieldArray', 'useController', 'setValue', 'getValues', 'trigger', 'reset']}
      notes="These tools are useful when native register() fields are not enough. They remain direct RHF APIs rather than being wrapped in a custom abstraction."
    >
      <form className={styles.form} noValidate onSubmit={handleSubmit(onSubmit)}>
        <section className={styles.section}>
          <h2>Watching and updating values</h2>
          <FormField id="title" label="Project title" error={errors.title?.message}>
            <input id="title" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-error' : undefined} {...register('title', { required: 'A project title is required.' })} />
          </FormField>
          <p className={styles.preview}>useWatch preview: <strong>{title || 'Untitled project'}</strong></p>
          <div className={styles.actions}>
            <button type="button" onClick={() => setValue('title', 'Concept registry cleanup', { shouldDirty: true })}>Prefill with setValue</button>
            <button type="button" onClick={validateTitle}>Validate title with trigger</button>
            <button type="button" onClick={() => setSnapshot(getValues())}>Inspect values with getValues</button>
          </div>
          {snapshot && <pre className={styles.snapshot}>{JSON.stringify(snapshot, null, 2)}</pre>}
        </section>

        <section className={styles.section}>
          <h2>Controlled input with useController</h2>
          <p className={styles.helper}>A custom button group calls field.onChange instead of spreading register() onto a native input.</p>
          <PriorityPicker control={control} />
        </section>

        <section className={styles.section}>
          <h2>Dependent field with watch</h2>
          <label className={styles.checkboxLabel} htmlFor="sendUpdates">
            <input id="sendUpdates" type="checkbox" {...register('sendUpdates')} />
            Send weekly project updates
          </label>
          {sendsUpdates && (
            <FormField id="updateEmail" label="Update email" error={errors.updateEmail?.message}>
              <input id="updateEmail" type="email" aria-invalid={Boolean(errors.updateEmail)} aria-describedby={errors.updateEmail ? 'updateEmail-error' : undefined} {...register('updateEmail', {
                validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter an email for updates.',
              })} />
            </FormField>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>Dynamic teammates with useFieldArray</h2>
            <button type="button" onClick={() => append({ name: '' })}>Add teammate</button>
          </div>
          {fields.map((field, index) => {
            const fieldName = `teammates.${index}.name`
            const fieldError = errors.teammates?.[index]?.name?.message

            return (
              <div className={styles.arrayRow} key={field.id}>
                <FormField id={`teammate-${field.id}`} label={`Teammate ${index + 1}`} error={fieldError}>
                  <input id={`teammate-${field.id}`} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `teammate-${field.id}-error` : undefined} {...register(fieldName, { required: 'Enter a teammate name.' })} />
                </FormField>
                {fields.length > 1 && <button type="button" onClick={() => remove(index)}>Remove</button>}
              </div>
            )
          })}
        </section>

        <div className={styles.footerActions}>
          <SubmitButton isSubmitting={isSubmitting}>Save project</SubmitButton>
          <button type="button" onClick={() => { reset(); setSnapshot(null); setSubmittedData(null) }}>Reset form</button>
        </div>
      </form>
      {submittedData && <p className={styles.success} role="status">Saved {submittedData.title || 'your project'} with {submittedData.teammates.length} teammate(s).</p>}
    </ConceptPageLayout>
  )
}

export default RhfAdvancedFeaturesPage
