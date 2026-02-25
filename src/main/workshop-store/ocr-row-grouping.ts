interface OcrRowWordLike {
  text: string;
  left: number;
  top: number;
  height: number;
}

interface RowGroupingDeps {
  sanitizeName: (raw: string) => string;
  clamp: (value: number, min: number, max: number) => number;
}

export function estimateOcrRowCount(words: OcrRowWordLike[], deps: RowGroupingDeps): number | null {
  const effectiveWords = words.filter((word) => deps.sanitizeName(word.text).trim().length > 0);
  if (effectiveWords.length === 0) {
    return null;
  }
  const points = effectiveWords
    .map((word) => ({
      centerY: word.top + word.height / 2,
      height: Math.max(1, word.height),
    }))
    .sort((left, right) => left.centerY - right.centerY);
  if (points.length === 0) {
    return null;
  }
  const heights = points.map((entry) => entry.height).sort((left, right) => left - right);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 1;
  const mergeDistance = Math.max(8, Math.floor(medianHeight * 0.65));

  let clusterCount = 0;
  let clusterCenter = 0;
  points.forEach((entry) => {
    if (clusterCount === 0) {
      clusterCount = 1;
      clusterCenter = entry.centerY;
      return;
    }
    if (Math.abs(entry.centerY - clusterCenter) <= mergeDistance) {
      clusterCenter = (clusterCenter + entry.centerY) / 2;
      return;
    }
    clusterCount += 1;
    clusterCenter = entry.centerY;
  });
  return deps.clamp(clusterCount, 1, 30);
}

export function groupOcrWordsByRow<T extends OcrRowWordLike>(
  words: T[],
  rowCount: number,
  totalHeight: number,
  clamp: (value: number, min: number, max: number) => number,
  startTop = 0,
): T[][] {
  const buckets: T[][] = Array.from({ length: rowCount }, () => []);
  const rowHeight = totalHeight / rowCount;
  words.forEach((word) => {
    const centerY = word.top + word.height / 2 - startTop;
    const rowIndex = clamp(Math.floor(centerY / Math.max(1, rowHeight)), 0, rowCount - 1);
    buckets[rowIndex].push(word);
  });
  return buckets.map((bucket) => bucket.sort((left, right) => left.left - right.left));
}
