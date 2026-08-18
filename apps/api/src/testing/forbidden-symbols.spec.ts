import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { scanForbiddenSymbols } from './source-scanner';

const REPO_ROOT = resolve(__dirname, '../../../../');
const SCAN_ROOTS = [join(REPO_ROOT, 'apps/api/src'), join(REPO_ROOT, 'libs')];

const FORBIDDEN = ['isFalse' + 'ConcentrationBlock', 'as unknown ' + 'as AgentId'];

describe('Static guard — anti-regression for CA-031/CA-034', () => {
  it('CA-076/CA-077: the current source tree has no hits for either forbidden symbol', () => {
    const hits = scanForbiddenSymbols(SCAN_ROOTS, FORBIDDEN, [__filename]);
    expect(hits).toEqual([]);
  });

  it('CA-078: reintroducing a forbidden symbol in a controlled fixture makes the scanner report it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crypto-trader-guard-fixture-'));
    try {
      const concentrationFile = join(dir, 'concentration-regression.ts');
      writeFileSync(concentrationFile, `const guard = '${FORBIDDEN[0]}';\n`);

      const castFile = join(dir, 'cast-regression.ts');
      writeFileSync(castFile, `const guard = value ${FORBIDDEN[1]};\n`);

      const hits = scanForbiddenSymbols([dir], FORBIDDEN, []);

      expect(hits).toHaveLength(2);
      expect(
        hits.some(
          (h) => h.pattern === FORBIDDEN[0] && h.file.endsWith('concentration-regression.ts'),
        ),
      ).toBe(true);
      expect(
        hits.some((h) => h.pattern === FORBIDDEN[1] && h.file.endsWith('cast-regression.ts')),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
