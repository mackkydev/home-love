export function externalWebUrl(value: string): string | undefined {
  if (!/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f]/.test(value)) return;
  try {
    const url = new URL(value);
    if (url.hostname && !url.username && !url.password) return url.href;
  } catch {
    return;
  }
}
