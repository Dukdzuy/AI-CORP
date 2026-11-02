/** The API's own reason for a failed request (Nest puts it in `message`), or the fallback */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' && message ? message : fallback;
}
