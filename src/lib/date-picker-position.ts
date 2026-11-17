type Rect = { left: number; top: number; bottom: number };
type Viewport = { left: number; top: number; width: number; height: number };

export function datePickerPosition(anchor: Rect, height: number, viewport: Viewport) {
  const margin = 12, gap = 6;
  const width = Math.min(290, Math.max(0, viewport.width - margin * 2));
  const leftEdge = viewport.left + margin;
  const topEdge = viewport.top + margin;
  const bottomEdge = viewport.top + viewport.height - margin;
  const below = Math.max(0, bottomEdge - Math.max(topEdge, anchor.bottom + gap));
  const above = Math.max(0, Math.min(bottomEdge, anchor.top - gap) - topEdge);
  const openAbove = height > below && above > below;
  const maxHeight = Math.min(viewport.height - margin * 2, openAbove ? above : below);
  return {
    width,
    left: Math.max(leftEdge, Math.min(anchor.left, viewport.left + viewport.width - margin - width)),
    top: openAbove ? Math.max(topEdge, Math.min(bottomEdge, anchor.top - gap) - Math.min(height, maxHeight))
      : Math.max(topEdge, Math.min(anchor.bottom + gap, bottomEdge - Math.min(height, maxHeight))),
    maxHeight: Math.max(0, maxHeight),
  };
}
