/**
 * Turn storage keys like `users/.../uploads/1775-uuid-my-id.pdf` into `my-id.pdf`.
 */
export function friendlyUploadName(inputFileKey: string): string {
  const segment = inputFileKey.split(/[/\\]/).pop() || inputFileKey;
  const stripped = segment.replace(/^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
  if (stripped && stripped !== segment) return stripped;
  const tail = segment.split("-").slice(-1)[0];
  if (tail?.includes(".")) return tail;
  return segment.length > 48 ? `${segment.slice(0, 20)}…${segment.slice(-12)}` : segment;
}

export function fileKindFromName(name: string): "pdf" | "image" | "other" {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp")) return "image";
  return "other";
}
