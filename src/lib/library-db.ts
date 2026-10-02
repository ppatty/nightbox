import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type ClipMeta = {
  id: string;
  name: string;
  categoryId: string | null;
  addedAt: number;
  duration: number;
  size: number;
  mime: string;
};

export type Category = {
  id: string;
  name: string;
  createdAt: number;
};

export type Playlist = {
  id: string;
  name: string;
  clipIds: string[];
  createdAt: number;
};

export type Prefs = {
  sort: "added" | "name" | "duration" | "size";
  sortDir: "asc" | "desc";
  group: boolean;
  layout: "grid" | "list";
  covers: boolean;
  showHint: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  sort: "added",
  sortDir: "desc",
  group: false,
  layout: "grid",
  covers: true,
  showHint: true,
};

interface NightboxDB extends DBSchema {
  clips: { key: string; value: ClipMeta };
  blobs: { key: string; value: Blob };
  posters: { key: string; value: Blob };
  categories: { key: string; value: Category };
  playlists: { key: string; value: Playlist };
  prefs: { key: string; value: Prefs };
}

export type LoadedLibrary = {
  clips: ClipMeta[];
  categories: Category[];
  playlists: Playlist[];
  prefs: Prefs;
  posters: { id: string; blob: Blob }[];
};

let dbPromise: Promise<IDBPDatabase<NightboxDB>> | null = null;

function database(): Promise<IDBPDatabase<NightboxDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser can't store a library."));
  }
  if (!dbPromise) {
    dbPromise = openDB<NightboxDB>("nightbox", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("clips")) db.createObjectStore("clips", { keyPath: "id" });
        if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
        if (!db.objectStoreNames.contains("posters")) db.createObjectStore("posters");
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("playlists")) {
          db.createObjectStore("playlists", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("prefs")) db.createObjectStore("prefs");
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizePrefs(value: Partial<Prefs> | undefined): Prefs {
  return { ...DEFAULT_PREFS, ...value };
}

export async function loadLibrary(): Promise<LoadedLibrary> {
  const db = await database();
  const [clips, categories, playlists, stored] = await Promise.all([
    db.getAll("clips"),
    db.getAll("categories"),
    db.getAll("playlists"),
    db.get("prefs", "main"),
  ]);
  const posters: { id: string; blob: Blob }[] = [];
  const tx = db.transaction("posters");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    posters.push({ id: String(cursor.key), blob: cursor.value });
    cursor = await cursor.continue();
  }
  await tx.done;
  return {
    clips,
    categories,
    playlists,
    prefs: normalizePrefs(stored),
    posters,
  };
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  const db = await database();
  await db.put("prefs", prefs, "main");
}

export async function putClip(meta: ClipMeta, blob: Blob, poster: Blob | null): Promise<void> {
  const db = await database();
  const tx = db.transaction(["clips", "blobs", "posters"], "readwrite");
  await tx.objectStore("clips").put(meta);
  await tx.objectStore("blobs").put(blob, meta.id);
  if (poster) await tx.objectStore("posters").put(poster, meta.id);
  await tx.done;
}

export async function renameClip(id: string, name: string): Promise<void> {
  const db = await database();
  const clip = await db.get("clips", id);
  if (!clip) return;
  await db.put("clips", { ...clip, name });
}

export async function setClipCategory(ids: string[], categoryId: string | null): Promise<void> {
  const db = await database();
  const tx = db.transaction("clips", "readwrite");
  for (const id of ids) {
    const clip = await tx.store.get(id);
    if (clip) await tx.store.put({ ...clip, categoryId });
  }
  await tx.done;
}

export async function deleteClips(ids: string[]): Promise<void> {
  const drop = new Set(ids);
  const db = await database();
  const tx = db.transaction(["clips", "blobs", "posters", "playlists"], "readwrite");
  for (const id of ids) {
    await tx.objectStore("clips").delete(id);
    await tx.objectStore("blobs").delete(id);
    await tx.objectStore("posters").delete(id);
  }
  const playlists = await tx.objectStore("playlists").getAll();
  for (const playlist of playlists) {
    const clipIds = playlist.clipIds.filter((id) => !drop.has(id));
    if (clipIds.length !== playlist.clipIds.length) {
      await tx.objectStore("playlists").put({ ...playlist, clipIds });
    }
  }
  await tx.done;
}

export async function putCategory(category: Category): Promise<void> {
  const db = await database();
  await db.put("categories", category);
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await database();
  const tx = db.transaction(["categories", "clips"], "readwrite");
  await tx.objectStore("categories").delete(id);
  const clips = await tx.objectStore("clips").getAll();
  for (const clip of clips) {
    if (clip.categoryId === id) await tx.objectStore("clips").put({ ...clip, categoryId: null });
  }
  await tx.done;
}

export async function putPlaylist(playlist: Playlist): Promise<void> {
  const db = await database();
  await db.put("playlists", playlist);
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await database();
  await db.delete("playlists", id);
}

export async function loadBlob(id: string): Promise<Blob | undefined> {
  const db = await database();
  return db.get("blobs", id);
}

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|m4v|mov|webm|mkv|avi|ogv|ogg|3gp|3g2)$/i.test(file.name);
}

export function prettyName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  return base || "Untitled";
}

export function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

export async function askToPersist(): Promise<void> {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* best effort — the library still saves for this session */
  }
}

export function capturePoster(file: Blob): Promise<{ duration: number; poster: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.width = "4px";
    video.style.height = "4px";
    document.body.appendChild(video);
    let settled = false;
    const finish = (duration: number, poster: Blob | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      video.remove();
      resolve({ duration, poster });
    };
    const draw = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const w = video.videoWidth || 0;
      const h = video.videoHeight || 0;
      if (!w || !h) {
        finish(duration, null);
        return;
      }
      const scale = Math.min(1, 480 / w);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.round(w * scale));
      canvas.height = Math.max(2, Math.round(h * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        finish(duration, null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => finish(duration, blob), "image/jpeg", 0.74);
    };
    const timer = window.setTimeout(draw, 2500);
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(0, null);
    };
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const target = duration > 0 ? Math.min(Math.max(duration * 0.08, 0.15), Math.max(duration - 0.05, 0)) : 0;
      if (target > 0) {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          window.clearTimeout(timer);
          draw();
        };
        video.addEventListener("seeked", onSeeked);
        try {
          video.currentTime = target;
        } catch {
          window.clearTimeout(timer);
          draw();
        }
      } else {
        window.clearTimeout(timer);
        if (video.readyState >= 2) draw();
        else video.onloadeddata = () => {
          window.clearTimeout(timer);
          draw();
        };
      }
    };
    video.src = url;
  });
}

export async function recordSample(
  title: string,
  hue: number,
): Promise<{ blob: Blob; poster: Blob; duration: number; mime: string }> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser can't make sample clips.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't draw a sample clip.");
  const mime =
    ["video/mp4", "video/webm;codecs=vp8", "video/webm"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? "";
  if (!mime) throw new Error("This browser can't make sample clips.");
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  rec.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    rec.onstop = () => resolve();
  });
  const durationMs = 3200;
  if (document.fonts?.ready) await document.fonts.ready.catch(() => undefined);
  rec.start();
  await new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      ctx.fillStyle = `hsl(${hue} 32% 12%)`;
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = `hsl(${hue} 62% ${36 + p * 18}%)`;
      ctx.beginPath();
      ctx.arc(140 + p * 380, 168, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f4efe6";
      ctx.font = "600 40px Outfit, sans-serif";
      ctx.fillText(title, 40, 310);
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  const poster = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No poster"))), "image/jpeg", 0.82);
  });
  return { blob: new Blob(chunks, { type: mime }), poster, duration: durationMs / 1000, mime };
}
