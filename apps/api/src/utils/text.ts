const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&nbsp;": " "
};

export function sanitizeText(value: string | null | undefined): string {
  if (!value) return "";

  let output = value.replace(/<script[\s\S]*?<\/script>/gi, " ");
  output = output.replace(/<style[\s\S]*?<\/style>/gi, " ");
  output = output.replace(/<[^>]+>/g, " ");

  for (const [entity, decoded] of Object.entries(ENTITY_MAP)) {
    output = output.split(entity).join(decoded);
  }

  // Decode basic numeric entities (e.g. &#8217;)
  output = output.replace(/&#(\d+);/g, (_match, codePoint) => {
    const parsed = Number(codePoint);
    if (!Number.isFinite(parsed) || parsed <= 0) return " ";
    return String.fromCodePoint(parsed);
  });

  return output.replace(/\s+/g, " ").trim();
}
