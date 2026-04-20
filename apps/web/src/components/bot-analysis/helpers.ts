import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function useTimeAgo() {
  const { t } = useTranslation();
  return (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t('botAnalysis.timeNow');
    if (mins < 60) return t('botAnalysis.timeMin', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('botAnalysis.timeHour', { count: hrs });
    return t('botAnalysis.timeDay', { count: Math.floor(hrs / 24) });
  };
}

export function fmt(n: number, decimals = 2) {
  return (
    n?.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) ?? '—'
  );
}

export function fmtPrice(n: number) {
  return n?.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '—';
}

/**
 * Returns a "MM:SS" string while time remains, or null when the target has passed.
 * Returns '--:--' when targetMs is null (no countdown applicable).
 */
export function useCountdown(targetMs: number | null): string | null {
  const [remaining, setRemaining] = useState<number>(
    targetMs ? Math.max(0, targetMs - Date.now()) : 0,
  );

  useEffect(() => {
    if (!targetMs) return;
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!targetMs) return '--:--';
  if (remaining <= 0) return null;
  const totalSec = Math.floor(remaining / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
