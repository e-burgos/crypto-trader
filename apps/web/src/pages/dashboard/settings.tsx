import { Settings } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your API keys and preferences
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <Settings className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="font-semibold">Settings</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Full settings management — coming in Spec 10.
        </p>
      </div>
    </div>
  );
}
