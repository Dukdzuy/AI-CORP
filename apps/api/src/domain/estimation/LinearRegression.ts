/**
 * Ordinary least squares with a small ridge term (Phase 6, Task 25).
 *
 * Solves (XᵀX + λI′)β = Xᵀy by Gaussian elimination, where I′ leaves the intercept
 * unpenalised. With a handful of samples the ridge term keeps the system solvable when
 * two projects have the same features.
 */
export class LinearRegression {
  private constructor(readonly coefficients: readonly number[]) {}

  /** `rows` are feature vectors without the intercept column */
  static fit(rows: readonly (readonly number[])[], targets: readonly number[], lambda = 1e-3): LinearRegression {
    if (!rows.length || rows.length !== targets.length) throw new Error('LinearRegression needs one target per row');
    const width = rows[0].length + 1;
    const X = rows.map(r => [1, ...r]);
    const A = Array.from({ length: width }, (_, i) =>
      Array.from({ length: width }, (_, j) => X.reduce((s, x) => s + x[i] * x[j], 0) + (i === j && i > 0 ? lambda : 0))
    );
    const b = Array.from({ length: width }, (_, i) => X.reduce((s, x, k) => s + x[i] * targets[k], 0));
    return new LinearRegression(LinearRegression.solve(A, b));
  }

  predict(features: readonly number[]): number {
    return this.coefficients.reduce((s, c, i) => s + c * (i === 0 ? 1 : features[i - 1]), 0);
  }

  /** Gaussian elimination with partial pivoting; a singular column gets coefficient 0 */
  private static solve(A: number[][], b: number[]): number[] {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
      [M[col], M[pivot]] = [M[pivot], M[col]];
      if (Math.abs(M[col][col]) < 1e-12) continue;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
  }
}
