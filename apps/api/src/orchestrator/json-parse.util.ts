export function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
    cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) return JSON.parse(match[0]) as T;
      return fallback;
    }
  } catch {
    return fallback;
  }
}
