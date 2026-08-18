import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export interface ForbiddenSymbolHit {
  file: string;
  line: number;
  pattern: string;
}

const SCANNED_EXTENSIONS = ['.ts', '.tsx'];
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage']);

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function collectSourceFiles(root: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    if (SKIPPED_DIRECTORIES.has(entry)) continue;

    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (SCANNED_EXTENSIONS.some((ext) => fullPath.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

export function scanForbiddenSymbols(
  roots: string[],
  patterns: string[],
  skipFiles: string[],
): ForbiddenSymbolHit[] {
  const normalizedSkip = new Set(skipFiles.map(normalizePath));
  const hits: ForbiddenSymbolHit[] = [];

  for (const root of roots) {
    for (const file of collectSourceFiles(root)) {
      const normalizedFile = normalizePath(file);
      if (normalizedSkip.has(normalizedFile)) continue;

      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((lineText, index) => {
        for (const pattern of patterns) {
          if (lineText.includes(pattern)) {
            hits.push({ file: normalizedFile, line: index + 1, pattern });
          }
        }
      });
    }
  }

  return hits;
}
