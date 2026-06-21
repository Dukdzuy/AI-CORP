/**
 * InputSanitizer
 *
 * Provides sanitization for user inputs and tool outputs to prevent
 * prompt injection attacks and ensure safe LLM interactions.
 *
 * Implements Requirement 25: Security and Input Validation
 */

// Patterns that indicate potential prompt injection attempts
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|commands?)/gi,
  /you\s+are\s+now\s+(a|an|the)\s+/gi,
  /system\s*:\s*/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|system\|>/gi,
  /<\|user\|>/gi,
  /<\|assistant\|>/gi,
  /###\s*(system|human|assistant)\s*:/gi,
  /assistant\s*:\s*/gi,
  /human\s*:\s*/gi,
  /system\s*:\s*/gi,
  /\bdo\s+not\s+(follow|obey|listen\s+to)\s+(the\s+)?(previous|prior|system)\b/gi,
  /\bdisregard\s+(all\s+)?(previous|prior|instructions?)\b/gi,
  /\bforget\s+(all\s+)?(previous|prior|instructions?)\b/gi,
  /\bnew\s+instructions?\s*:/gi,
  /\boverride\s+(system|previous|prior)\b/gi,
];

// Characters that should be escaped in tool outputs
const ESCAPE_PATTERNS = [
  { pattern: /</g, replacement: '&lt;' },
  { pattern: />/g, replacement: '&gt;' },
];

/**
 * Sanitize user input to prevent prompt injection.
 *
 * Detects and neutralizes common prompt injection patterns
 * while preserving legitimate content.
 *
 * @param input - Raw user input string
 * @returns Sanitized string safe for LLM consumption
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Check for injection patterns and neutralize them
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      // Wrap detected patterns in markers to make them visible to LLM
      sanitized = sanitized.replace(pattern, (match) => `[NEUTRALIZED: ${match}]`);
      // Reset regex lastIndex since we're using global flag
      pattern.lastIndex = 0;
    }
  }

  // Limit input length to prevent abuse
  const MAX_INPUT_LENGTH = 50000;
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);
  }

  return sanitized;
}

/**
 * Sanitize tool output before including in LLM prompts.
 *
 * Tool outputs may contain untrusted content (file contents, command output, etc.)
 * that could be exploited for prompt injection. This function escapes special
 * characters and wraps output in delimiters.
 *
 * @param output - Raw tool output string
 * @param toolName - Name of the tool that produced the output (for context)
 * @returns Sanitized string safe for inclusion in prompts
 */
export function sanitizeToolOutput(output: string, toolName: string): string {
  if (!output || typeof output !== 'string') {
    return `[${toolName}: no output]`;
  }

  let sanitized = output;

  // Escape HTML-like characters that could be interpreted as special tokens
  for (const { pattern, replacement } of ESCAPE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // Truncate very long outputs to prevent context window overflow
  const MAX_OUTPUT_LENGTH = 100000;
  if (sanitized.length > MAX_OUTPUT_LENGTH) {
    const truncated = sanitized.slice(0, MAX_OUTPUT_LENGTH);
    sanitized = `${truncated}\n\n[OUTPUT TRUNCATED: ${sanitized.length - MAX_OUTPUT_LENGTH} characters omitted]`;
  }

  // Wrap in delimiters to clearly separate tool output from prompt content
  return `[TOOL_OUTPUT name="${toolName}"]\n${sanitized}\n[/TOOL_OUTPUT]`;
}

/**
 * Validate that a string does not contain prompt injection attempts.
 *
 * Used for logging and monitoring rather than blocking.
 *
 * @param input - String to check
 * @returns true if input appears safe, false if injection detected
 */
export function isInputSafe(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return true;
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      pattern.lastIndex = 0;
      return false;
    }
  }

  return true;
}

/**
 * Strip potential injection payloads from input.
 *
 * More aggressive than sanitizeUserInput - removes detected patterns entirely.
 *
 * @param input - Raw input string
 * @returns Cleaned string with injection patterns removed
 */
export function stripInjectionPayloads(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let cleaned = input;

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REMOVED]');
    pattern.lastIndex = 0;
  }

  return cleaned;
}
