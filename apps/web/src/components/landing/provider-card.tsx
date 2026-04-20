import { useTranslation } from 'react-i18next';

export function ProviderCard({
  name,
  description,
  highlight,
  featured,
  featuredLabel,
}: {
  name: string;
  description: string;
  highlight: string;
  featured?: boolean;
  featuredLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`provider-card relative flex flex-col rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg ${
        featured
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 hover:border-primary hover:shadow-primary/20 ring-1 ring-primary/30'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-primary/8'
      }`}
    >
      {featured && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
          ★ {featuredLabel || t('common.recommended')}
        </div>
      )}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className={`text-base font-bold ${featured ? 'text-primary' : 'text-foreground'}`}
        >
          {name}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${
            featured
              ? 'bg-primary/20 text-primary ring-primary/40'
              : 'bg-primary/10 text-primary ring-primary/20'
          }`}
        >
          {highlight}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
