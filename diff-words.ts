export type DiffToken = { text: string; type: "same" | "add" | "remove" };

/**
 * Small word-level diff (LCS-based) used only by the workspace's "Compare"
 * toggle. Deliberately simple — this is a manually-triggered, one-shot
 * comparison of two bounded-length texts (max ~5000 chars, so a few
 * hundred words), not something run on every keystroke.
 */
export function diffWords(before: string, after: string): DiffToken[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);

  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ text: a[i], type: "same" });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      tokens.push({ text: a[i], type: "remove" });
      i++;
    } else {
      tokens.push({ text: b[j], type: "add" });
      j++;
    }
  }
  while (i < n) {
    tokens.push({ text: a[i], type: "remove" });
    i++;
  }
  while (j < m) {
    tokens.push({ text: b[j], type: "add" });
    j++;
  }

  return tokens;
}
