import { useState } from 'react';
import { User, Loader2, TableConfig } from 'lucide-react';
import { Button, Input } from '@crypto-trader/ui';
import { useTranslation } from 'react-i18next';
import { useUserProfile, useUpdateProfile } from '../../hooks/use-user';

export function AdminProfilePage() {
  const { t } = useTranslation();
  const { data: profile } = useUserProfile();
  const { mutate: updateProfile, isPending: savingProfile } =
    useUpdateProfile();
  const [profileForm, setProfileForm] = useState({ email: '', password: '' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <TableConfig className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.profileTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.profileSubtitle')}
        </p>
      </div>

      {/* Profile form */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">{t('settings.profile')}</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.email')}
            </label>
            <input
              type="email"
              placeholder={profile?.email ?? ''}
              value={profileForm.email}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, email: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.password')}
            </label>
            <Input
              type="password"
              value={profileForm.password}
              onChange={(e) =>
                setProfileForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder={t('settings.passwordPlaceholder')}
            />
          </div>
          <Button
            size="sm"
            disabled={
              savingProfile || (!profileForm.email && !profileForm.password)
            }
            onClick={() => {
              const data: { email?: string; password?: string } = {};
              if (profileForm.email) data.email = profileForm.email;
              if (profileForm.password) data.password = profileForm.password;
              updateProfile(data, {
                onSuccess: () => setProfileForm({ email: '', password: '' }),
              });
            }}
          >
            {savingProfile && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t('settings.saveProfile')}
          </Button>
        </div>
      </div>

      {/* Account Info */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">{t('admin.accountInfo')}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('common.role')}</span>
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500">
              ADMIN
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t('settings.email')}
            </span>
            <span className="font-medium">{profile?.email ?? '–'}</span>
          </div>
          {profile?.createdAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('admin.memberSince')}
              </span>
              <span className="font-medium">
                {new Date(profile.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
