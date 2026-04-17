export function truncateUnicode(str: string, maxLen: number): string {
  const chars = Array.from(str);
  if (chars.length <= maxLen) return str;
  return chars.slice(0, maxLen).join("") + "…";
}
