/** Derive a human-readable filename from stored object keys like `users/.../uploads/123-uuid-original.pdf`. */
export function friendlyFileName(inputFileKey: string): string {
  const segment = inputFileKey.split("/").pop() ?? inputFileKey;
  const uuidTail =
    /^\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i.exec(segment);
  if (uuidTail?.[1]) return decodeSafeName(uuidTail[1]);
  return decodeSafeName(segment);
}

function decodeSafeName(name: string) {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function fileKindFromName(name: string): "pdf" | "image" | "other" {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp")) return "image";
  return "other";
}
