import { Link } from 'react-router';
import { login } from '../../api/auth.js';
import { Button } from '../../components/ui/Button.jsx';
import { FormErrorSummary, Notice } from '../../components/ui/Feedback.jsx';
import { PasswordField, TextField } from '../../components/ui/Field.jsx';
import { useDocumentTitle } from '../../components/ui/hooks.js';
import { Card } from '../../components/ui/PageHeader.jsx';
import { copy, messageForError } from '../../domain/copy.js';
import { useAuthStore } from '../../stores/authStore.js';
import styles from './Auth.module.css';
import { loginSchema } from './schemas.js';
import { useAuthForm } from './useAuthForm.js';

const loginError = (error) => {
  if (error?.status === 401) return copy.auth.invalidCredentials;
  if (error?.status === 403) return copy.auth.deactivated;
  return messageForError(error);
};

export function LoginPage() {
  useDocumentTitle('Sign In');
  const signOutReason = useAuthStore((s) => s.signOutReason);
  const { form, onSubmit, formError } = useAuthForm({
    schema: loginSchema,
    defaultValues: { email: '', password: '' },
    submit: login,
    errorMessage: loginError,
  });
  const { register, formState } = form;
  const { errors, isSubmitting } = formState;

  return (
    <Card>
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-labelledby="login-title">
        <div className={styles.header}>
          <h1 id="login-title">Sign In</h1>
          <p className={styles.subtitle}>Raise and track IT support requests.</p>
        </div>
        {signOutReason === 'expired' && !formError && <Notice>{copy.auth.sessionExpired}</Notice>}
        <FormErrorSummary title="Couldn't sign you in" message={formError} />
        <TextField
          id="field-email"
          label="Email address"
          type="email"
          autoComplete="username"
          inputMode="email"
          spellCheck={false}
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          id="field-password"
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          variant="primary"
          className={styles.submit}
          loading={isSubmitting}
          loadingLabel="Signing in…"
        >
          Sign in
        </Button>
        <p className={styles.switch}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </Card>
  );
}
