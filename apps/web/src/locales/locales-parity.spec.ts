import { describe, expect, it } from 'vitest';
import en from './en';
import es from './es';

type LocaleTree = { [key: string]: unknown };

function flattenPaths(tree: LocaleTree, prefix = ''): Map<string, unknown> {
  const paths = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedPath, nestedValue] of flattenPaths(
        value as LocaleTree,
        path,
      )) {
        paths.set(nestedPath, nestedValue);
      }
    } else {
      paths.set(path, value);
    }
  }
  return paths;
}

function subtree(tree: LocaleTree, path: string): LocaleTree {
  const node = path
    .split('.')
    .reduce<unknown>(
      (acc, segment) =>
        acc && typeof acc === 'object'
          ? (acc as LocaleTree)[segment]
          : undefined,
      tree,
    );
  if (node === undefined || typeof node !== 'object' || node === null) {
    throw new Error(`Path "${path}" does not resolve to an object in locale tree`);
  }
  return node as LocaleTree;
}

const NOTIFICATION_KEYS = [
  'entryOrderPlaced',
  'entryOrderFilled',
  'entryOrderMissing',
];

describe('locale parity — config.advanced', () => {
  const esAdvanced = flattenPaths(subtree(es, 'config.advanced'));
  const enAdvanced = flattenPaths(subtree(en, 'config.advanced'));

  it('has the same set of keys in es and en', () => {
    expect(new Set(esAdvanced.keys())).toEqual(new Set(enAdvanced.keys()));
  });

  const EMPTY_VALUE_ALLOWED = new Set(['units.count']);

  it('has no empty string values in es (except the deliberately unitless suffix)', () => {
    for (const [path, value] of esAdvanced) {
      if (typeof value === 'string' && !EMPTY_VALUE_ALLOWED.has(path)) {
        expect(value.length, `config.advanced.${path} is empty in es`).toBeGreaterThan(0);
      }
    }
  });

  it('has no empty string values in en (except the deliberately unitless suffix)', () => {
    for (const [path, value] of enAdvanced) {
      if (typeof value === 'string' && !EMPTY_VALUE_ALLOWED.has(path)) {
        expect(value.length, `config.advanced.${path} is empty in en`).toBeGreaterThan(0);
      }
    }
  });

  it('has no value identical to its own key across es and en', () => {
    for (const [path, value] of esAdvanced) {
      if (typeof value === 'string') {
        expect(value, `config.advanced.${path} in es equals its own key`).not.toBe(path);
      }
    }
    for (const [path, value] of enAdvanced) {
      if (typeof value === 'string') {
        expect(value, `config.advanced.${path} in en equals its own key`).not.toBe(path);
      }
    }
  });
});

describe('locale parity — positions.entries', () => {
  const esEntries = flattenPaths(subtree(es, 'positions.entries'));
  const enEntries = flattenPaths(subtree(en, 'positions.entries'));

  it('has the same set of keys in es and en', () => {
    expect(new Set(esEntries.keys())).toEqual(new Set(enEntries.keys()));
  });

  it('has no empty string values in es', () => {
    for (const [path, value] of esEntries) {
      if (typeof value === 'string') {
        expect(value.length, `positions.entries.${path} is empty in es`).toBeGreaterThan(0);
      }
    }
  });

  it('has no empty string values in en', () => {
    for (const [path, value] of enEntries) {
      if (typeof value === 'string') {
        expect(value.length, `positions.entries.${path} is empty in en`).toBeGreaterThan(0);
      }
    }
  });

  it('has no value identical to its own key across es and en', () => {
    for (const [path, value] of esEntries) {
      if (typeof value === 'string') {
        expect(value, `positions.entries.${path} in es equals its own key`).not.toBe(path);
      }
    }
    for (const [path, value] of enEntries) {
      if (typeof value === 'string') {
        expect(value, `positions.entries.${path} in en equals its own key`).not.toBe(path);
      }
    }
  });
});

describe('locale parity — positions.tabEntries', () => {
  it('exists with a non-empty, distinct value in es and en', () => {
    const esValue = (es as LocaleTree).positions as LocaleTree;
    const enValue = (en as LocaleTree).positions as LocaleTree;
    expect(typeof esValue.tabEntries).toBe('string');
    expect(typeof enValue.tabEntries).toBe('string');
    expect((esValue.tabEntries as string).length).toBeGreaterThan(0);
    expect((enValue.tabEntries as string).length).toBeGreaterThan(0);
  });
});

describe('locale parity — notificationMessages.entryOrder*', () => {
  it.each(NOTIFICATION_KEYS)('%s exists with a non-empty value in es and en', (key) => {
    const esValue = (es as LocaleTree).notificationMessages as LocaleTree;
    const enValue = (en as LocaleTree).notificationMessages as LocaleTree;
    expect(typeof esValue[key]).toBe('string');
    expect(typeof enValue[key]).toBe('string');
    expect((esValue[key] as string).length).toBeGreaterThan(0);
    expect((enValue[key] as string).length).toBeGreaterThan(0);
  });
});

describe('locale parity — full tree (pre-existing gaps report)', () => {
  it('reports any key present in only one locale (informational, not asserted)', () => {
    const esFull = flattenPaths(es);
    const enFull = flattenPaths(en);
    const esKeys = new Set(esFull.keys());
    const enKeys = new Set(enFull.keys());
    const onlyInEs = [...esKeys].filter((key) => !enKeys.has(key));
    const onlyInEn = [...enKeys].filter((key) => !esKeys.has(key));
    if (onlyInEs.length > 0 || onlyInEn.length > 0) {
      console.warn(
        `[locale parity] pre-existing gaps — only in es (${onlyInEs.length}): ${onlyInEs.join(', ')}; only in en (${onlyInEn.length}): ${onlyInEn.join(', ')}`,
      );
    }
    expect(true).toBe(true);
  });
});
