import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { PasswordInput } from '../components/ui/password-input';
import { useAuthStore } from '../store/auth.store';

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    setLocalError('');

    if (password !== confirm) {
      setLocalError(t('auth.passwordsNoMatch'));
      return;
    }
    if (password.length < 8) {
      setLocalError(t('auth.passwordTooShort'));
      return;
    }

    try {
      await register(email, password);
      navigate('/onboarding', { replace: true });
    } catch {
      // error is set in store
    }
  }

  const displayError = localError || error;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t('auth.registerTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('auth.registerSubtitle')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          {displayError && (
            <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium"
              >
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium"
              >
                {t('auth.password')}
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder={t('auth.minCharsPlaceholder')}
              />
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="mb-1.5 block text-sm font-medium"
              >
                {t('auth.confirmPassword')}
              </label>
              <PasswordInput
                id="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('auth.registerButton')
              )}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link
            to="/login"
            className="font-medium text-primary hover:underline"
          >
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
