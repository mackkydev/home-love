export function mobileViewport({ innerHeight, visualHeight, offsetTop = 0, scale = 1, editing }: {
  innerHeight: number; visualHeight?: number; offsetTop?: number; scale?: number; editing: boolean;
}): { height: number; top: number } | null {
  if (Math.abs(scale - 1) > .01) return null;
  const visual = visualHeight && visualHeight > 0 ? visualHeight : innerHeight;
  // After dismissing the iOS keyboard the visual viewport can briefly retain its old size.
  const height = editing ? Math.min(innerHeight, visual) : Math.max(innerHeight, visual);
  return height > 0 && Number.isFinite(height) ? { height: Math.round(height), top: editing ? Math.max(0, Math.round(offsetTop)) : 0 } : null;
}
