export interface WheelScrollInput {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
  deltaY: number;
  deltaX: number;
}

export interface WheelScrollResult {
  preventDefault: boolean;
  newScrollLeft: number;
}

export function computeTabWheelScroll(input: WheelScrollInput): WheelScrollResult {
  const { scrollLeft, scrollWidth, clientWidth, deltaY, deltaX } = input;
  const delta = deltaY !== 0 ? deltaY : deltaX;
  const max = Math.max(0, scrollWidth - clientWidth);

  if (max <= 0 || delta === 0) {
    return { preventDefault: false, newScrollLeft: scrollLeft };
  }
  if (scrollLeft <= 0 && delta < 0) {
    return { preventDefault: false, newScrollLeft: 0 };
  }
  if (scrollLeft >= max && delta > 0) {
    return { preventDefault: false, newScrollLeft: max };
  }
  const next = Math.max(0, Math.min(max, scrollLeft + delta));
  return { preventDefault: true, newScrollLeft: next };
}
