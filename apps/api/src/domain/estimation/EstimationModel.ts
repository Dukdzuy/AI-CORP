/**
 * Effort and cost estimation from the platform's own history (Phase 6, Task 25)
 *
 * One training sample is the work of one agent role on one finished project: the summed
 * duration of the role's workflow steps and its LLM cost. Features are what is known about
 * a project: the length of its description and goal, and the number of use cases the BA
 * wrote (unknown at creation, then imputed with the median of the history).
 *
 * Per role the model picks the estimator the data supports:
 * - `regression` (ridge least squares on the features) from `minRegressionSamples` samples,
 * - `median` of the history below that,
 * - no estimate for a role without history.
 * The model is evaluated with leave-one-out cross-validation (MAE and MAPE), so the
 * reported accuracy is measured, not assumed.
 *
 * Replaces the original TensorFlow.js network: a few dozen projects cannot train a
 * 64-unit network, while a linear model is explainable in the thesis.
 *
 * @pattern Strategy (estimator per role), Factory Method (`train`)
 */
import { LinearRegression } from './LinearRegression';
import { mean, median, round } from '../analytics/stats';

export interface EstimationFeatures {
  descriptionLength: number;
  /** null when the use cases are not written yet */
  useCaseCount: number | null;
}

export interface EstimationSample {
  projectId: string;
  role: string;
  workflowDefId: string;
  features: { descriptionLength: number; useCaseCount: number };
  durationMs: number;
  cost: number;
}

export type EstimationMethod = 'regression' | 'median';

export interface IEstimator {
  readonly method: EstimationMethod;
  predict(features: EstimationSample['features']): number;
}

export const featureVector = (f: EstimationSample['features']): number[] => [f.descriptionLength / 1000, f.useCaseCount];

export class MedianEstimator implements IEstimator {
  readonly method = 'median' as const;
  private readonly value: number;
  constructor(targets: readonly number[]) {
    this.value = median(targets);
  }
  predict(): number {
    return this.value;
  }
}

export class RegressionEstimator implements IEstimator {
  readonly method = 'regression' as const;
  private readonly regression: LinearRegression;
  private readonly floor: number;
  constructor(samples: readonly EstimationSample['features'][], targets: readonly number[]) {
    this.regression = LinearRegression.fit(samples.map(featureVector), targets);
    // A line can go below zero outside the data; never predict less than the smallest seen
    this.floor = Math.min(...targets);
  }
  predict(features: EstimationSample['features']): number {
    return Math.max(this.floor, this.regression.predict(featureVector(features)));
  }
  get coefficients(): readonly number[] {
    return this.regression.coefficients;
  }
}

export interface Evaluation {
  /** Leave-one-out mean absolute error; null with fewer than 2 samples */
  maeDurationMs: number | null;
  mapeDuration: number | null;
  maeCost: number | null;
  mapeCost: number | null;
}

export interface RoleModelSummary {
  role: string;
  samples: number;
  method: EstimationMethod;
  evaluation: Evaluation;
}

export type Confidence = 'low' | 'medium' | 'high';

export interface RoleForecast {
  role: string;
  durationMs: number;
  cost: number;
  method: EstimationMethod;
  samples: number;
}

export interface Forecast {
  durationMs: number;
  cost: number;
  confidence: Confidence;
  byRole: RoleForecast[];
  features: { descriptionLength: number; useCaseCount: number };
  /** Features that were not known and were filled with the history's median */
  imputed: string[];
  /** Roles with no history, so not part of the total */
  unknownRoles: string[];
  trainingProjects: number;
}

export interface EstimationOptions {
  minRegressionSamples: number;
}

const DEFAULT_OPTIONS: EstimationOptions = { minRegressionSamples: 6 };

class RoleModel {
  constructor(
    readonly role: string,
    readonly samples: readonly EstimationSample[],
    readonly duration: IEstimator,
    readonly cost: IEstimator,
    readonly evaluation: Evaluation
  ) {}

  get method(): EstimationMethod {
    return this.duration.method;
  }
}

export class EstimationModel {
  private constructor(
    private readonly roles: ReadonlyMap<string, RoleModel>,
    private readonly medianUseCases: number,
    readonly trainingProjects: number,
    readonly options: EstimationOptions
  ) {}

  static train(samples: readonly EstimationSample[], options: Partial<EstimationOptions> = {}): EstimationModel {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const byRole = new Map<string, EstimationSample[]>();
    for (const s of samples) {
      if (!byRole.has(s.role)) byRole.set(s.role, []);
      byRole.get(s.role)!.push(s);
    }
    const roles = new Map<string, RoleModel>();
    for (const [role, list] of byRole) {
      const fit = (set: readonly EstimationSample[]) => EstimationModel.fitRole(set, opts);
      const { duration, cost } = fit(list);
      roles.set(role, new RoleModel(role, list, duration, cost, EstimationModel.leaveOneOut(list, fit)));
    }
    const projects = new Map(samples.map(s => [s.projectId, s.features.useCaseCount]));
    return new EstimationModel(roles, median([...projects.values()]), projects.size, opts);
  }

  private static fitRole(samples: readonly EstimationSample[], opts: EstimationOptions): { duration: IEstimator; cost: IEstimator } {
    const durations = samples.map(s => s.durationMs);
    const costs = samples.map(s => s.cost);
    if (samples.length >= opts.minRegressionSamples) {
      const features = samples.map(s => s.features);
      return { duration: new RegressionEstimator(features, durations), cost: new RegressionEstimator(features, costs) };
    }
    return { duration: new MedianEstimator(durations), cost: new MedianEstimator(costs) };
  }

  /** Each sample is predicted by a model trained on all the others */
  private static leaveOneOut(
    samples: readonly EstimationSample[],
    fit: (set: readonly EstimationSample[]) => { duration: IEstimator; cost: IEstimator }
  ): Evaluation {
    if (samples.length < 2) return { maeDurationMs: null, mapeDuration: null, maeCost: null, mapeCost: null };
    const errD: number[] = [], pctD: number[] = [], errC: number[] = [], pctC: number[] = [];
    samples.forEach((held, i) => {
      const model = fit(samples.filter((_, j) => j !== i));
      const d = model.duration.predict(held.features);
      const c = model.cost.predict(held.features);
      errD.push(Math.abs(d - held.durationMs));
      errC.push(Math.abs(c - held.cost));
      if (held.durationMs > 0) pctD.push(Math.abs(d - held.durationMs) / held.durationMs);
      if (held.cost > 0) pctC.push(Math.abs(c - held.cost) / held.cost);
    });
    return {
      maeDurationMs: Math.round(mean(errD)),
      mapeDuration: pctD.length ? round(mean(pctD)) : null,
      maeCost: round(mean(errC), 6),
      mapeCost: pctC.length ? round(mean(pctC)) : null,
    };
  }

  summary(): RoleModelSummary[] {
    return [...this.roles.values()]
      .map(r => ({ role: r.role, samples: r.samples.length, method: r.method, evaluation: r.evaluation }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }

  /** Roles that worked on earlier projects of this workflow, or every known role */
  rolesFor(workflowDefId: string | null): string[] {
    const all = [...this.roles.values()];
    const matching = workflowDefId ? all.filter(r => r.samples.some(s => s.workflowDefId === workflowDefId)) : [];
    return (matching.length ? matching : all).map(r => r.role).sort();
  }

  forecast(features: EstimationFeatures, roles: readonly string[]): Forecast {
    const imputed: string[] = [];
    let useCaseCount = features.useCaseCount;
    if (useCaseCount === null) {
      useCaseCount = this.medianUseCases;
      imputed.push('useCaseCount');
    }
    const known = { descriptionLength: features.descriptionLength, useCaseCount };

    const byRole: RoleForecast[] = [];
    const unknownRoles: string[] = [];
    for (const role of roles) {
      const model = this.roles.get(role);
      if (!model) {
        unknownRoles.push(role);
        continue;
      }
      byRole.push({
        role,
        durationMs: Math.round(model.duration.predict(known)),
        cost: round(model.cost.predict(known), 6),
        method: model.method,
        samples: model.samples.length,
      });
    }

    return {
      durationMs: byRole.reduce((s, r) => s + r.durationMs, 0),
      cost: round(byRole.reduce((s, r) => s + r.cost, 0), 6),
      confidence: this.confidence(byRole, unknownRoles),
      byRole,
      features: known,
      imputed,
      unknownRoles,
      trainingProjects: this.trainingProjects,
    };
  }

  /**
   * high: every role uses regression and its measured duration error is ≤ 25 %;
   * low: no history, a role is missing, or a role has fewer than 3 samples; otherwise medium.
   */
  private confidence(byRole: readonly RoleForecast[], unknownRoles: readonly string[]): Confidence {
    if (!byRole.length || unknownRoles.length || byRole.some(r => r.samples < 3)) return 'low';
    const errors = byRole.map(r => this.roles.get(r.role)!.evaluation.mapeDuration);
    if (byRole.every(r => r.method === 'regression') && errors.every(e => e !== null && e <= 0.25)) return 'high';
    return 'medium';
  }
}

/** Forecast against what really happened */
export interface ForecastComparison {
  predictedDurationMs: number;
  actualDurationMs: number;
  predictedCost: number;
  actualCost: number;
  durationError: number | null; // relative, signed: +0.2 = took 20 % longer than predicted
  costError: number | null;
}

export function compareForecast(predicted: { durationMs: number; cost: number }, actual: { durationMs: number; cost: number }): ForecastComparison {
  const rel = (p: number, a: number) => (p > 0 ? round((a - p) / p) : null);
  return {
    predictedDurationMs: predicted.durationMs,
    actualDurationMs: actual.durationMs,
    predictedCost: predicted.cost,
    actualCost: round(actual.cost, 6),
    durationError: rel(predicted.durationMs, actual.durationMs),
    costError: rel(predicted.cost, actual.cost),
  };
}
