/**
 * Parsers for the plain-text replies agents give in collaboration turns (Task 15).
 * LLM answers are free text, so each parser looks for one marker line and has a safe default.
 */

/**
 * Reads "DECISION: ACCEPT|REJECT" (or "VERDICT: PASS|FAIL") from the last such line.
 * No marker → accepted, so a reviewer that forgets the marker does not block the pair forever.
 */
export function parseVerdict(text: string): boolean {
  const matches = [...(text || '').matchAll(/^\s*(?:\*\*)?(?:DECISION|VERDICT)(?:\*\*)?\s*:\s*\**\s*(ACCEPT|APPROVE|PASS|REJECT|FAIL)\b/gim)];
  if (!matches.length) return true;
  return !/^(REJECT|FAIL)$/i.test(matches[matches.length - 1][1]);
}

/** "QUESTION: UC-003: what happens when ..." lines, at most `limit` of them */
export function parseQuestions(text: string, limit = 3): string[] {
  const questions: string[] = [];
  for (const match of (text || '').matchAll(/^\s*[-*]?\s*QUESTION\s*:\s*(.+)$/gim)) {
    const question = match[1].trim();
    if (question && !/^none\b/i.test(question)) questions.push(question);
    if (questions.length >= limit) break;
  }
  return questions;
}

/** The use case a question is about ("UC-003: ..." → UC-003) */
export function useCaseIdOf(question: string): string | undefined {
  return /\bUC-\d{3}\b/i.exec(question || '')?.[0].toUpperCase();
}

/** Text without the marker lines, for the Meeting Room and the next agent's prompt */
export function stripMarkers(text: string): string {
  return (text || '')
    .split('\n')
    .filter(line => !/^\s*[-*]?\s*(?:\*\*)?(?:DECISION|VERDICT|QUESTION)(?:\*\*)?\s*:/i.test(line))
    .join('\n')
    .trim();
}
