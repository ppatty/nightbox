import type { Category, ClipMeta, Prefs } from "@/lib/library-db";

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const SORTS: { sort: Prefs["sort"]; sortDir: Prefs["sortDir"]; label: string }[] = [
  { sort: "added", sortDir: "desc", label: "Newest" },
  { sort: "added", sortDir: "asc", label: "Oldest" },
  { sort: "name", sortDir: "asc", label: "Name A–Z" },
  { sort: "name", sortDir: "desc", label: "Name Z–A" },
  { sort: "duration", sortDir: "desc", label: "Longest" },
  { sort: "duration", sortDir: "asc", label: "Shortest" },
  { sort: "size", sortDir: "desc", label: "Largest" },
];

export function sortLabel(prefs: Pick<Prefs, "sort" | "sortDir">): string {
  return SORTS.find((item) => item.sort === prefs.sort && item.sortDir === prefs.sortDir)?.label ?? "Newest";
}

export function visibleClips(
  clips: ClipMeta[],
  opts: { query: string; categoryId: string | "all"; prefs: Pick<Prefs, "sort" | "sortDir"> },
): ClipMeta[] {
  const query = opts.query.trim().toLowerCase();
  const list = clips.filter((clip) => {
    if (opts.categoryId !== "all" && clip.categoryId !== opts.categoryId) return false;
    if (query && !clip.name.toLowerCase().includes(query)) return false;
    return true;
  });
  const dir = opts.prefs.sortDir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (opts.prefs.sort) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "duration":
        return (a.duration - b.duration) * dir;
      case "size":
        return (a.size - b.size) * dir;
      default:
        return (a.addedAt - b.addedAt) * dir;
    }
  });
}

export type ClipSection = { key: string; name: string; clips: ClipMeta[] };

export function groupClips(clips: ClipMeta[], categories: Category[], enabled: boolean): ClipSection[] {
  if (!enabled) return [{ key: "all", name: "", clips }];
  const buckets = new Map<string, ClipMeta[]>();
  for (const clip of clips) {
    const key = clip.categoryId ?? "";
    const existing = buckets.get(key);
    if (existing) existing.push(clip);
    else buckets.set(key, [clip]);
  }
  const sections: ClipSection[] = [];
  const ordered = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  for (const category of ordered) {
    const list = buckets.get(category.id);
    if (list?.length) sections.push({ key: category.id, name: category.name, clips: list });
  }
  const none = buckets.get("");
  if (none?.length) sections.push({ key: "none", name: "No category", clips: none });
  return sections;
}
