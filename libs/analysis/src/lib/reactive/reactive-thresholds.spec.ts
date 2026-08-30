import {
  DEFAULT_MATERIAL_EVENT_THRESHOLDS,
  MaterialEventThresholds,
} from './reactive-thresholds';
import { DEFAULT_GATE_THRESHOLDS } from '../gate/gate-thresholds';

describe('DEFAULT_MATERIAL_EVENT_THRESHOLDS', () => {
  it('mirrors the gate priceChangePct default so both thresholds agree', () => {
    expect(DEFAULT_MATERIAL_EVENT_THRESHOLDS.priceChangePct).toBe(
      DEFAULT_GATE_THRESHOLDS.priceChangePct,
    );
  });

  it('exposes exactly the five documented fields with sane, positive values', () => {
    const keys = Object.keys(DEFAULT_MATERIAL_EVENT_THRESHOLDS).sort();

    expect(keys).toEqual(
      [
        'levelConfirmDistancePct',
        'minEvaluationIntervalMs',
        'priceChangePct',
        'volumeMinElapsedFraction',
        'volumeSpikeRatio',
      ].sort(),
    );

    const values: MaterialEventThresholds = DEFAULT_MATERIAL_EVENT_THRESHOLDS;
    for (const value of Object.values(values)) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it('keeps volumeMinElapsedFraction within (0, 1]', () => {
    expect(DEFAULT_MATERIAL_EVENT_THRESHOLDS.volumeMinElapsedFraction).toBeGreaterThan(0);
    expect(DEFAULT_MATERIAL_EVENT_THRESHOLDS.volumeMinElapsedFraction).toBeLessThanOrEqual(1);
  });
});
