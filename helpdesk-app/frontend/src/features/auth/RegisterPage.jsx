import { Link } from 'react-router';
import { register as registerUser } from '../../api/auth.js';
import { Button } from '../../components/ui/Button.jsx';
import { FormErrorSummary } from '../../components/ui/Feedback.jsx';
import { PasswordField, TextField } from '../../components/ui/Field.jsx';
import { useDocumentTitle } from '../../components/ui/hooks.js';
import { Card } from '../../components/ui/PageHeader.jsx';
import styles from './Auth.module.css';
import { registerSchema } from './schemas.js';
import { useAuthForm } from './useAuthForm.js';

export function RegisterPage() {
  useDocumentTitle('Create Account');
  const { form, onSubmit, formError } = useAuthForm({
    schema: registerSchema,
    defaultValues: { name: '', email: '', password: '' },
    submit: registerUser,
  });
  const { register, formState } = form;
  const { errors, isSubmitting } = formState;

  return (
    <Card>
      <form className={styles.form} onSubmit={onSubmit} noValidate aria-labelledby="register-title">
        <div className={styles.header}>
          <h1 id="register-title">Create Your Account</h1>
          <p className={styles.subtitle}>You can raise tickets as soon as you sign up.</p>
        </div>
        <FormErrorSummary title="Couldn't create your account" message={formError} />
        <TextField
          id="field-name"
          label="Full name"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          id="field-email"
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          id="field-password"
          label="Password"
          hint="At least 12 characters. A passphrase of a few words works well."
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          variant="primary"
          className={styles.submit}
          loading={isSubmitting}
          loadingLabel="Creating account…"
        >
          Create account
        </Button>
        <p className={styles.switch}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </Card>
  );
}
