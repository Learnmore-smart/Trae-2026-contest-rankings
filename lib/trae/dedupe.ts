type TopicTitleCarrier = {
  topic?: {
    title?: string | null;
  } | null;
};

export function normalizeTitleForDedupe(title: string | null | undefined): string {
  return (title ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function dedupeByTopicTitle<T extends TopicTitleCarrier>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = normalizeTitleForDedupe(item.topic?.title);
    if (!key) {
      result.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}
