import { EstimationModel, EstimationSample, LinearRegression, compareForecast } from '../../../src/domain/estimation';

/** A synthetic history where DEV time and cost grow linearly with the use cases and the description */
function history(n: number, noise = 0): EstimationSample[] {
  const samples: EstimationSample[] = [];
  for (let i = 0; i < n; i++) {
    const useCaseCount = 2 + (i % 5);
    const descriptionLength = 400 + ((i * 137) % 900);
    const wiggle = noise ? (i % 2 ? 1 : -1) * noise : 0;
    samples.push({
      projectId: `p${i}`,
      role: 'DEV',
      workflowDefId: 'ooad',
      features: { descriptionLength, useCaseCount },
      durationMs: Math.round((20_000 + 8_000 * useCaseCount + 10 * descriptionLength) * (1 + wiggle)),
      cost: (0.02 + 0.01 * useCaseCount) * (1 + wiggle),
    });
    samples.push({
      projectId: `p${i}`, role: 'BA', workflowDefId: 'ooad', features: { descriptionLength, useCaseCount },
      durationMs: 5_000 + i * 10, cost: 0.01,
    });
  }
  return samples;
}

describe('Phase 6 / Task 25: estimation (domain)', () => {
  it('LinearRegression recovers an exact linear relation and survives duplicate rows', () => {
    const rows = [[1, 2], [2, 1], [3, 5], [4, 3], [5, 4]];
    const y = rows.map(([a, b]) => 3 + 2 * a - 1.5 * b);
    const model = LinearRegression.fit(rows, y, 0);
    expect(model.coefficients[0]).toBeCloseTo(3, 6);
    expect(model.coefficients[1]).toBeCloseTo(2, 6);
    expect(model.coefficients[2]).toBeCloseTo(-1.5, 6);
    expect(model.predict([10, 10])).toBeCloseTo(8, 6);

    // Same features twice and a constant column: the ridge term keeps it solvable
    const flat = LinearRegression.fit([[1, 0], [1, 0], [1, 0]], [2, 4, 6]);
    expect(flat.predict([1, 0])).toBeCloseTo(4, 2);
    expect(() => LinearRegression.fit([], [])).toThrow();
  });

  it('chooses regression from enough samples, the median below that', () => {
    const model = EstimationModel.train(history(10));
    expect(model.summary().map(r => [r.role, r.method, r.samples])).toEqual([['BA', 'regression', 10], ['DEV', 'regression', 10]]);
    const small = EstimationModel.train(history(4));
    expect(small.summary().every(r => r.method === 'median')).toBe(true);
    expect(EstimationModel.train(history(4), { minRegressionSamples: 3 }).summary()[0].method).toBe('regression');
  });

  it('leave-one-out accuracy: MAPE below 20 % on noisy linear data (the plan\'s acceptance criterion)', () => {
    const dev = EstimationModel.train(history(20, 0.1)).summary().find(r => r.role === 'DEV')!;
    expect(dev.evaluation.mapeDuration).not.toBeNull();
    expect(dev.evaluation.mapeDuration!).toBeLessThan(0.2);
    expect(dev.evaluation.mapeCost!).toBeLessThan(0.2);
    expect(dev.evaluation.maeDurationMs).toBeGreaterThan(0);

    const one = EstimationModel.train(history(1)).summary()[0];
    expect(one.evaluation).toEqual({ maeDurationMs: null, mapeDuration: null, maeCost: null, mapeCost: null });
  });

  it('forecast sums the roles, imputes unknown use cases and reports roles without history', () => {
    const model = EstimationModel.train(history(10));
    const forecast = model.forecast({ descriptionLength: 1000, useCaseCount: 4 }, ['BA', 'DEV', 'MARKETING']);
    const dev = forecast.byRole.find(r => r.role === 'DEV')!;
    expect(dev.durationMs).toBeCloseTo(20_000 + 8_000 * 4 + 10_000, -2);
    expect(dev.cost).toBeCloseTo(0.06, 3);
    expect(forecast.durationMs).toBe(forecast.byRole.reduce((s, r) => s + r.durationMs, 0));
    expect(forecast.unknownRoles).toEqual(['MARKETING']);
    expect(forecast.confidence).toBe('low');
    expect(forecast.trainingProjects).toBe(10);

    const early = model.forecast({ descriptionLength: 1000, useCaseCount: null }, ['DEV']);
    expect(early.imputed).toEqual(['useCaseCount']);
    expect(early.features.useCaseCount).toBe(4); // median of 2..6 over the history
  });

  it('confidence: high for accurate regressions, medium for medians, low without history', () => {
    expect(EstimationModel.train(history(12)).forecast({ descriptionLength: 800, useCaseCount: 3 }, ['DEV']).confidence).toBe('high');
    expect(EstimationModel.train(history(4)).forecast({ descriptionLength: 800, useCaseCount: 3 }, ['DEV']).confidence).toBe('medium');
    expect(EstimationModel.train(history(2)).forecast({ descriptionLength: 800, useCaseCount: 3 }, ['DEV']).confidence).toBe('low');
    const empty = EstimationModel.train([]).forecast({ descriptionLength: 800, useCaseCount: null }, ['DEV']);
    expect(empty).toMatchObject({ durationMs: 0, cost: 0, confidence: 'low', unknownRoles: ['DEV'], trainingProjects: 0 });
  });

  it('never predicts below the smallest observed value', () => {
    const model = EstimationModel.train(history(10));
    const tiny = model.forecast({ descriptionLength: 0, useCaseCount: -50 }, ['DEV']);
    expect(tiny.byRole[0].durationMs).toBeGreaterThanOrEqual(Math.min(...history(10).filter(s => s.role === 'DEV').map(s => s.durationMs)));
  });

  it('roles of the same workflow, or all roles when the workflow is new', () => {
    const samples = [...history(3), { ...history(1)[0], role: 'MARKETING', workflowDefId: 'other' }];
    const model = EstimationModel.train(samples);
    expect(model.rolesFor('ooad')).toEqual(['BA', 'DEV']);
    expect(model.rolesFor('unknown')).toEqual(['BA', 'DEV', 'MARKETING']);
    expect(model.rolesFor(null)).toEqual(['BA', 'DEV', 'MARKETING']);
  });

  it('compares a forecast with the outcome as signed relative errors', () => {
    expect(compareForecast({ durationMs: 1000, cost: 0.1 }, { durationMs: 1200, cost: 0.05 })).toEqual({
      predictedDurationMs: 1000, actualDurationMs: 1200, predictedCost: 0.1, actualCost: 0.05, durationError: 0.2, costError: -0.5,
    });
    expect(compareForecast({ durationMs: 0, cost: 0 }, { durationMs: 5, cost: 1 })).toMatchObject({ durationError: null, costError: null });
  });
});
