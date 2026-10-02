import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  askToPersist,
  capturePoster,
  deleteCategory as dbDeleteCategory,
  deleteClips as dbDeleteClips,
  deletePlaylist as dbDeletePlaylist,
  isQuotaError,
  isVideoFile,
  loadBlob,
  loadLibrary,
  prettyName,
  putCategory,
  putClip,
  putPlaylist,
  recordSample,
  renameClip as dbRenameClip,
  savePrefs,
  setClipCategory,
  uid,
  type Category,
  type ClipMeta,
  type Playlist,
  type Prefs,
} from "@/lib/library-db";

type LibraryApi = {
  ready: boolean;
  error: string | null;
  clips: ClipMeta[];
  categories: Category[];
  playlists: Playlist[];
  prefs: Prefs;
  busy: string | null;
  note: string | null;
  posterUrl: (id: string) => string | undefined;
  libraryBytes: number;
  importFiles: (files: File[]) => Promise<void>;
  addSamples: () => Promise<void>;
  renameClip: (id: string, name: string) => Promise<void>;
  removeClips: (ids: string[]) => Promise<void>;
  moveToCategory: (ids: string[], categoryId: string | null) => Promise<void>;
  createCategory: (name: string) => Promise<string | null>;
  renameCategory: (id: string, name: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  createPlaylist: (name: string, clipIds?: string[]) => Promise<string | null>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  removePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (playlistId: string, clipIds: string[]) => Promise<void>;
  removeFromPlaylist: (playlistId: string, clipId: string) => Promise<void>;
  moveInPlaylist: (playlistId: string, clipId: string, dir: -1 | 1) => Promise<void>;
  updatePrefs: (patch: Partial<Prefs>) => Promise<void>;
  getBlob: (id: string) => Promise<Blob | undefined>;
  dismissNote: () => void;
};

const LibraryContext = createContext<LibraryApi | null>(null);

export function useLibrary(): LibraryApi {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("Library is not ready");
  return value;
}

function cleanName(name: string): string {
  return name.trim().slice(0, 80);
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipMeta[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({
    sort: "added",
    sortDir: "desc",
    group: false,
    layout: "grid",
    covers: true,
    showHint: true,
  });
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const created: string[] = [];
    loadLibrary()
      .then((loaded) => {
        if (cancel) return;
        const urls: Record<string, string> = {};
        for (const poster of loaded.posters) {
          const url = URL.createObjectURL(poster.blob);
          urls[poster.id] = url;
          created.push(url);
        }
        setClips(loaded.clips);
        setCategories(loaded.categories);
        setPlaylists(loaded.playlists);
        setPrefs(loaded.prefs);
        setPosters(urls);
        setReady(true);
      })
      .catch(() => {
        if (!cancel) {
          setError("Couldn't open the library on this device.");
          setReady(true);
        }
      });
    return () => {
      cancel = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 4200);
    return () => window.clearTimeout(timer);
  }, [note]);

  const posterUrl = useCallback((id: string) => posters[id], [posters]);

  const libraryBytes = useMemo(() => clips.reduce((sum, clip) => sum + clip.size, 0), [clips]);

  const rememberPoster = useCallback((id: string, poster: Blob | null) => {
    if (!poster) return;
    const url = URL.createObjectURL(poster);
    setPosters((prev) => {
      const previous = prev[id];
      if (previous) URL.revokeObjectURL(previous);
      return { ...prev, [id]: url };
    });
  }, []);

  const importFiles = useCallback(
    async (files: File[]) => {
      const videos = files.filter(isVideoFile);
      if (!videos.length) {
        setNote(files.length ? "Those files aren't videos." : "No videos picked.");
        return;
      }
      await askToPersist();
      let saved = 0;
      let failed = 0;
      let full = false;
      for (let i = 0; i < videos.length; i++) {
        const file = videos[i]!;
        setBusy(`Saving ${i + 1} of ${videos.length}`);
        try {
          const captured = await capturePoster(file);
          const meta: ClipMeta = {
            id: uid(),
            name: prettyName(file.name),
            categoryId: null,
            addedAt: Date.now(),
            duration: captured.duration,
            size: file.size,
            mime: file.type || "video/mp4",
          };
          await putClip(meta, file, captured.poster);
          setClips((prev) => [meta, ...prev.filter((clip) => clip.id !== meta.id)]);
          rememberPoster(meta.id, captured.poster);
          saved += 1;
        } catch (err) {
          failed += 1;
          if (isQuotaError(err)) {
            full = true;
            break;
          }
        }
      }
      setBusy(null);
      if (full) {
        setNote(
          saved
            ? `Saved ${saved}. This device filled up before the rest could be kept.`
            : "Not enough room on this device to keep that video in Nightbox.",
        );
        return;
      }
      if (failed && saved) setNote(`Saved ${saved}. ${failed} couldn't be read.`);
      else if (failed) setNote("Couldn't read those videos.");
      else setNote(saved === 1 ? "Saved to this device." : `Saved ${saved} videos on this device.`);
    },
    [rememberPoster],
  );

  const addSamples = useCallback(async () => {
    setBusy("Making sample clips");
    try {
      let category = categories.find((item) => item.name.toLowerCase() === "samples");
      if (!category) {
        category = { id: uid(), name: "Samples", createdAt: Date.now() };
        await putCategory(category);
        setCategories((prev) => [...prev, category!]);
      }
      const specs = [
        { title: "Amber drift", hue: 32 },
        { title: "Dusk line", hue: 16 },
        { title: "Slow tide", hue: 198 },
      ];
      for (const spec of specs) {
        const made = await recordSample(spec.title, spec.hue);
        const meta: ClipMeta = {
          id: uid(),
          name: spec.title,
          categoryId: category.id,
          addedAt: Date.now(),
          duration: made.duration,
          size: made.blob.size,
          mime: made.mime,
        };
        await putClip(meta, made.blob, made.poster);
        setClips((prev) => [meta, ...prev]);
        rememberPoster(meta.id, made.poster);
      }
      setNote("Three sample clips are on the shelf. Delete them whenever you want.");
    } catch {
      setNote("Couldn't make sample clips in this browser.");
    } finally {
      setBusy(null);
    }
  }, [categories, rememberPoster]);

  const renameClip = useCallback(async (id: string, name: string) => {
    const next = cleanName(name);
    if (!next) return;
    await dbRenameClip(id, next);
    setClips((prev) => prev.map((clip) => (clip.id === id ? { ...clip, name: next } : clip)));
  }, []);

  const removeClips = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    await dbDeleteClips(ids);
    const drop = new Set(ids);
    setClips((prev) => prev.filter((clip) => !drop.has(clip.id)));
    setPlaylists((prev) =>
      prev.map((playlist) => ({
        ...playlist,
        clipIds: playlist.clipIds.filter((id) => !drop.has(id)),
      })),
    );
    setPosters((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        const url = next[id];
        if (url) URL.revokeObjectURL(url);
        delete next[id];
      }
      return next;
    });
  }, []);

  const moveToCategory = useCallback(async (ids: string[], categoryId: string | null) => {
    await setClipCategory(ids, categoryId);
    const set = new Set(ids);
    setClips((prev) => prev.map((clip) => (set.has(clip.id) ? { ...clip, categoryId } : clip)));
  }, []);

  const createCategory = useCallback(async (name: string) => {
    const next = cleanName(name);
    if (!next) return null;
    const category: Category = { id: uid(), name: next, createdAt: Date.now() };
    await putCategory(category);
    setCategories((prev) => [...prev, category]);
    return category.id;
  }, []);

  const renameCategory = useCallback(async (id: string, name: string) => {
    const next = cleanName(name);
    if (!next) return;
    let updated: Category | null = null;
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== id) return category;
        updated = { ...category, name: next };
        return updated;
      }),
    );
    if (updated) await putCategory(updated);
  }, []);

  const removeCategory = useCallback(async (id: string) => {
    await dbDeleteCategory(id);
    setCategories((prev) => prev.filter((category) => category.id !== id));
    setClips((prev) => prev.map((clip) => (clip.categoryId === id ? { ...clip, categoryId: null } : clip)));
  }, []);

  const createPlaylist = useCallback(async (name: string, clipIds: string[] = []) => {
    const next = cleanName(name);
    if (!next) return null;
    const playlist: Playlist = {
      id: uid(),
      name: next,
      clipIds: [...new Set(clipIds)],
      createdAt: Date.now(),
    };
    await putPlaylist(playlist);
    setPlaylists((prev) => [playlist, ...prev]);
    return playlist.id;
  }, []);

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    const next = cleanName(name);
    if (!next) return;
    let updated: Playlist | null = null;
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== id) return playlist;
        updated = { ...playlist, name: next };
        return updated;
      }),
    );
    if (updated) await putPlaylist(updated);
  }, []);

  const removePlaylist = useCallback(async (id: string) => {
    await dbDeletePlaylist(id);
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== id));
  }, []);

  const addToPlaylist = useCallback(async (playlistId: string, clipIds: string[]) => {
    let updated: Playlist | null = null;
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        const seen = new Set(playlist.clipIds);
        const extra = clipIds.filter((id) => !seen.has(id));
        updated = { ...playlist, clipIds: [...playlist.clipIds, ...extra] };
        return updated;
      }),
    );
    if (updated) await putPlaylist(updated);
  }, []);

  const removeFromPlaylist = useCallback(async (playlistId: string, clipId: string) => {
    let updated: Playlist | null = null;
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        updated = { ...playlist, clipIds: playlist.clipIds.filter((id) => id !== clipId) };
        return updated;
      }),
    );
    if (updated) await putPlaylist(updated);
  }, []);

  const moveInPlaylist = useCallback(async (playlistId: string, clipId: string, dir: -1 | 1) => {
    let updated: Playlist | null = null;
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        const index = playlist.clipIds.indexOf(clipId);
        const target = index + dir;
        if (index < 0 || target < 0 || target >= playlist.clipIds.length) return playlist;
        const clipIds = [...playlist.clipIds];
        const [item] = clipIds.splice(index, 1);
        clipIds.splice(target, 0, item!);
        updated = { ...playlist, clipIds };
        return updated;
      }),
    );
    if (updated) await putPlaylist(updated);
  }, []);

  const updatePrefs = useCallback(async (patch: Partial<Prefs>) => {
    let next: Prefs | null = null;
    setPrefs((prev) => {
      next = { ...prev, ...patch };
      return next;
    });
    if (next) await savePrefs(next);
  }, []);

  const getBlob = useCallback((id: string) => loadBlob(id), []);

  const value = useMemo<LibraryApi>(
    () => ({
      ready,
      error,
      clips,
      categories,
      playlists,
      prefs,
      busy,
      note,
      posterUrl,
      libraryBytes,
      importFiles,
      addSamples,
      renameClip,
      removeClips,
      moveToCategory,
      createCategory,
      renameCategory,
      removeCategory,
      createPlaylist,
      renamePlaylist,
      removePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      moveInPlaylist,
      updatePrefs,
      getBlob,
      dismissNote: () => setNote(null),
    }),
    [
      ready,
      error,
      clips,
      categories,
      playlists,
      prefs,
      busy,
      note,
      posterUrl,
      libraryBytes,
      importFiles,
      addSamples,
      renameClip,
      removeClips,
      moveToCategory,
      createCategory,
      renameCategory,
      removeCategory,
      createPlaylist,
      renamePlaylist,
      removePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      moveInPlaylist,
      updatePrefs,
      getBlob,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
