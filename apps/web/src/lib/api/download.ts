import { apiClient } from './client';

/** Downloads an API file response (zip, csv, pdf…) under the name the server gives it */
export async function downloadFile(path: string, params: Record<string, string | undefined> = {}, fallbackName = 'download'): Promise<string> {
  const response = await apiClient.get<Blob>(path, { params, responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] || '');
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return fileName;
}
