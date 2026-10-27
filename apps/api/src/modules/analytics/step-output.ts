/**
 * Reads the fields analytics needs out of a stored workflow step output (Phase 6).
 *
 * The engine stores a node result as JSON text; for agent tasks it is the agent's
 * `{ thought, action: { success, output: { ...fields } } }`. Older rows and collaboration
 * nodes have other shapes, so every field is optional.
 */
export interface StepOutputFields {
  qaApproved?: boolean;
  qcPassed?: boolean;
  predictedQaVerdict?: 'pass' | 'fail';
}

export function parseStepOutput(raw: unknown): Record<string, any> | null {
  let value: any = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const action = value.action ?? value;
  const fields = action && typeof action.output === 'object' && action.output !== null ? action.output : action;
  return fields && typeof fields === 'object' ? fields : null;
}

export function stepOutputFields(raw: unknown): StepOutputFields {
  const f = parseStepOutput(raw);
  if (!f) return {};
  const out: StepOutputFields = {};
  if (typeof f.qa_approved === 'boolean') out.qaApproved = f.qa_approved;
  if (typeof f.qc_passed === 'boolean') out.qcPassed = f.qc_passed;
  const predicted = f.codeQuality?.predictedQaVerdict;
  if (predicted === 'pass' || predicted === 'fail') out.predictedQaVerdict = predicted;
  return out;
}
