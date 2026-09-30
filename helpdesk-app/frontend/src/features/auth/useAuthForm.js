import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { fieldErrorsFrom } from '../../api/errors.js';
import { messageForError } from '../../domain/copy.js';
import { useAuthStore } from '../../stores/authStore.js';

/**
 * Shared submit/error handling for sign-in and sign-up.
 * Validation runs after a field is first left (modern-web-guidance: validate after interaction).
 */
export function useAuthForm({ schema, defaultValues, submit, errorMessage }) {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState(null);

  const form = useForm({ resolver: zodResolver(schema), defaultValues, mode: 'onTouched' });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const session = await submit(values);
      setSession(session);
      navigate(location.state?.from?.pathname ?? '/tickets', { replace: true });
    } catch (error) {
      for (const [name, message] of Object.entries(fieldErrorsFrom(error))) {
        form.setError(name, { message });
      }
      setFormError(errorMessage?.(error) ?? messageForError(error));
    }
  });

  return { form, onSubmit, formError };
}
