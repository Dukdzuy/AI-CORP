/**
 * One-paragraph summary of the approved OOAD design (use cases, entities, patterns, style),
 * shared by the reviewers: QA and the Architect in pair_develop.
 */
export function summarizeDesign(ooadMetadata: unknown): string {
  const m = (ooadMetadata as any) || {};
  const lines: string[] = [];
  if (m.useCases?.length) {
    lines.push(`Use cases: ${m.useCases.map((uc: any) => `${uc.id} ${uc.name}`).join('; ')}`);
  }
  if (m.domainModel?.entities?.length) {
    lines.push(`Entities: ${m.domainModel.entities.map((e: any) => e.name).join(', ')}`);
  }
  if (m.domainModel?.valueObjects?.length) {
    lines.push(`Value objects: ${m.domainModel.valueObjects.map((v: any) => v.name).join(', ')}`);
  }
  if (m.patterns?.length) {
    lines.push(`Patterns: ${m.patterns.map((p: any) => `${p.name} (${p.location})`).join('; ')}`);
  }
  if (m.architecture?.style) {
    lines.push(`Architecture style: ${m.architecture.style}`);
  }
  return lines.join('\n');
}
