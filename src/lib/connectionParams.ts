/**
 * Parses a one-line "key=value" list into ClickHouse settings.
 * Pairs can be separated by "&", ",", spaces or newlines, e.g.:
 *   enable_analyzer=0&max_execution_time=300
 */
export function parseCustomParams(raw?: string): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  raw.split(/[&,\s]+/).forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx <= 0) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) out[key] = value;
  });
  return out;
}
