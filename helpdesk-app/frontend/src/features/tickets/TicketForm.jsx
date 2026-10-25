import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { fieldErrorsFrom } from '../../api/errors.js';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { FormErrorSummary } from '../../components/ui/Feedback.jsx';
import { Select, TextArea, TextField } from '../../components/ui/Field.jsx';
import { messageForError } from '../../domain/copy.js';
import { PRIORITIES, PRIORITY_LABELS } from '../../domain/labels.js';
import { ticketSchema } from './ticketSchema.js';
import styles from './Tickets.module.css';

/**
 * Shared create/edit form. On a server error the user's input is kept and the error is
 * shown in a focused summary plus next to the affected fields (journey-mapping: never make
 * users re-type after a failure).
 */
export function TicketForm({ defaultValues, onSubmit, submitLabel, pendingLabel, cancelTo }) {
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(ticketSchema),
    defaultValues: { title: '', description: '', priority: 'MEDIUM', ...defaultValues },
    mode: 'onTouched',
  });

  const submit = handleSubmit(
    async (values) => {
      setFormError(null);
      try {
        await onSubmit(values);
      } catch (error) {
        const fields = fieldErrorsFrom(error);
        for (const [name, message] of Object.entries(fields)) setError(name, { message });
        setFormError(messageForError(error));
      }
    },
    () => setFormError(null),
  );

  const fieldErrors = Object.fromEntries(
    Object.entries(errors).map(([name, error]) => [name, error.message]),
  );

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <FormErrorSummary
        title="Fix the following to continue"
        message={formError}
        fieldErrors={isSubmitting ? {} : fieldErrors}
      />
      <TextField
        id="field-title"
        label="Title"
        hint="A short summary, e.g. “Laptop won't connect to VPN”."
        maxLength={200}
        error={errors.title?.message}
        {...register('title')}
      />
      <TextArea
        id="field-description"
        label="Description"
        hint="What happened, what you expected, and any error messages you saw."
        rows={8}
        error={errors.description?.message}
        {...register('description')}
      />
      <Select
        id="field-priority"
        label="Priority"
        hint="High means you can't work until it's fixed."
        error={errors.priority?.message}
        {...register('priority')}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </Select>
      <div className={styles.formActions}>
        <Button type="submit" variant="primary" loading={isSubmitting} loadingLabel={pendingLabel}>
          {submitLabel}
        </Button>
        <ButtonLink to={cancelTo} variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
