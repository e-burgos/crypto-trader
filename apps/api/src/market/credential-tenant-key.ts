const SEPARATOR = '::';

export function buildTenantKey(sourceName: string, ownerKey: string): string {
  return `${sourceName}${SEPARATOR}${ownerKey}`;
}

export function sourceNameOfTenantKey(tenantKey: string): string {
  const index = tenantKey.indexOf(SEPARATOR);
  return index === -1 ? tenantKey : tenantKey.slice(0, index);
}
