import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Film,
  LayoutGrid,
  List,
  ListVideo,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { LibraryProvider, useLibrary } from "@/components/nightbox/library-context";
import { Player } from "@/components/nightbox/player";
import type { Category, ClipMeta, Playlist } from "@/lib/library-db";
import { formatBytes, formatTime, groupClips, sortLabel, SORTS, visibleClips } from "@/lib/library-view";

type Screen = { kind: "library" } | { kind: "playlists" } | { kind: "playlist"; id: string };

type Sheet =
  | { kind: "sort" }
  | { kind: "settings" }
  | { kind: "clip"; id: string }
  | { kind: "rename"; id: string }
  | { kind: "rename-playlist"; id: string }
  | { kind: "categorize"; ids: string[] }
  | { kind: "to-playlist"; ids: string[] }
  | { kind: "new-playlist" }
  | { kind: "delete"; ids: string[] }
  | { kind: "delete-category"; id: string }
  | { kind: "delete-playlist"; id: string };

type PlayerState = { ids: string[]; index: number; label: string };

export function Nightbox() {
  return (
    <LibraryProvider>
      <ShelfApp />
    </LibraryProvider>
  );
}

function ShelfApp() {
  const lib = useLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [screen, setScreen] = useState<Screen>({ kind: "library" });
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [dragging, setDragging] = useState(false);

  const byId = useMemo(() => new Map(lib.clips.map((clip) => [clip.id, clip])), [lib.clips]);
  const shown = useMemo(
    () => visibleClips(lib.clips, { query, categoryId, prefs: lib.prefs }),
    [lib.clips, query, categoryId, lib.prefs],
  );
  const sections = useMemo(
    () => groupClips(shown, lib.categories, lib.prefs.group && categoryId === "all"),
    [shown, lib.categories, lib.prefs.group, categoryId],
  );
  const flat = useMemo(() => sections.flatMap((section) => section.clips), [sections]);
  const categoryName = useMemo(() => {
    const map = new Map(lib.categories.map((category) => [category.id, category.name]));
    return (id: string | null) => (id ? map.get(id) ?? "Category" : "No category");
  }, [lib.categories]);

  const liveQueue = player?.ids.map((id) => byId.get(id)).filter((clip): clip is ClipMeta => Boolean(clip)) ?? [];
  const playerIndex = player ? Math.min(player.index, Math.max(liveQueue.length - 1, 0)) : 0;

  useEffect(() => {
    if (screen.kind === "playlist" && !lib.playlists.some((playlist) => playlist.id === screen.id)) {
      setScreen({ kind: "playlists" });
    }
  }, [screen, lib.playlists]);

  function openImport() {
    fileRef.current?.click();
  }

  function exitSelect() {
    setSelecting(false);
    setSelected([]);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function playIds(ids: string[], index: number, label: string) {
    const existing = ids.filter((id) => byId.has(id));
    if (!existing.length) return;
    const startId = ids[index];
    const start = startId ? existing.indexOf(startId) : 0;
    setPlayer({ ids: existing, index: Math.max(0, start), label });
    exitSelect();
  }

  const openPlaylist = lib.playlists.find((playlist) => screen.kind === "playlist" && playlist.id === screen.id);

  return (
    <div
      className="min-h-dvh bg-bg text-fg"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void lib.importFiles([...event.dataTransfer.files]);
      }}
    >
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border px-4 py-5 lg:flex">
          <Brand />
          <button type="button" className={`${btn("primary")} mt-5 w-full`} onClick={openImport}>
            <Plus className="size-5" />
            Import
          </button>
          <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
            <div>
              <p className="mb-2 text-sm text-muted">Categories</p>
              <SideButton active={screen.kind === "library" && categoryId === "all"} onClick={() => { setScreen({ kind: "library" }); setCategoryId("all"); }}>
                All videos
                <span className="opacity-70">{lib.clips.length}</span>
              </SideButton>
              {sortedCategories(lib.categories).map((category) => (
                <SideButton
                  key={category.id}
                  active={screen.kind === "library" && categoryId === category.id}
                  onClick={() => {
                    setScreen({ kind: "library" });
                    setCategoryId(category.id);
                  }}
                >
                  <span className="truncate">{category.name}</span>
                  <span className="opacity-70">{lib.clips.filter((clip) => clip.categoryId === category.id).length}</span>
                </SideButton>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm text-muted">Playlists</p>
              <SideButton active={screen.kind === "playlists"} onClick={() => setScreen({ kind: "playlists" })}>
                All playlists
              </SideButton>
              {[...lib.playlists].sort((a, b) => b.createdAt - a.createdAt).map((playlist) => (
                <SideButton
                  key={playlist.id}
                  active={screen.kind === "playlist" && screen.id === playlist.id}
                  onClick={() => setScreen({ kind: "playlist", id: playlist.id })}
                >
                  <span className="truncate">{playlist.name}</span>
                  <span className="text-muted">{playlist.clipIds.length}</span>
                </SideButton>
              ))}
            </div>
          </nav>
          <p className="pt-3 text-sm text-muted">{formatBytes(lib.libraryBytes)} on this device</p>
        </aside>

        <main className="min-w-0 flex-1 pb-28">
          <header className="safe-top sticky top-0 z-20 bg-bg px-4 pt-4">
            <div className="h-0.5 bg-accent" />
            <div className="mt-3 flex items-end justify-between gap-3 lg:hidden">
              <Brand />
            </div>
            <p className="mt-1 text-sm text-muted lg:mt-0">
              {lib.clips.length === 1 ? "1 video" : `${lib.clips.length} videos`}
              {" · "}
              {formatBytes(lib.libraryBytes)} on this device
            </p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your videos"
                className="h-12 w-full rounded-2xl border border-border bg-surface pr-12 pl-11 text-base text-fg outline-none placeholder:text-muted"
                aria-label="Search your videos"
              />
              {query && (
                <button type="button" className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center" onClick={() => setQuery("")} aria-label="Clear search">
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-3 no-scrollbar">
              <ToolbarButton onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
                {selecting ? "Cancel" : "Select"}
              </ToolbarButton>
              <ToolbarButton onClick={() => setSheet({ kind: "sort" })}>{sortLabel(lib.prefs)}</ToolbarButton>
              <button
                type="button"
                className={iconBtn}
                aria-label={lib.prefs.layout === "grid" ? "Show as a list" : "Show as a grid"}
                onClick={() => void lib.updatePrefs({ layout: lib.prefs.layout === "grid" ? "list" : "grid" })}
              >
                {lib.prefs.layout === "grid" ? <List className="size-5" /> : <LayoutGrid className="size-5" />}
              </button>
              <button type="button" className={iconBtn} aria-label="Settings" onClick={() => setSheet({ kind: "settings" })}>
                <Settings className="size-5" />
              </button>
              <div className="ml-auto hidden gap-2 lg:flex">
                <button type="button" className={btn("primary")} onClick={openImport}>
                  <Plus className="size-5" />
                  Import
                </button>
              </div>
            </div>
            <div className="mb-3 flex h-12 rounded-2xl bg-surface p-1 lg:hidden">
              <Segment
                active={screen.kind === "library"}
                onClick={() => setScreen({ kind: "library" })}
              >
                Library
              </Segment>
              <Segment
                active={screen.kind !== "library"}
                onClick={() => setScreen(screen.kind === "playlist" ? screen : { kind: "playlists" })}
              >
                Playlists
              </Segment>
            </div>
          </header>

          {lib.note && (
            <p className="px-4 pb-2 text-sm text-muted" role="status">
              {lib.note}
            </p>
          )}
          {lib.busy && (
            <p className="px-4 pb-3 text-sm text-accent" role="status">
              {lib.busy}
            </p>
          )}

          {screen.kind === "library" && (
            <>
              <div className="flex gap-2 overflow-x-auto px-4 pb-4 no-scrollbar lg:hidden">
                <Chip active={categoryId === "all"} onClick={() => setCategoryId("all")}>
                  All
                </Chip>
                {sortedCategories(lib.categories).map((category) => (
                  <Chip key={category.id} active={categoryId === category.id} onClick={() => setCategoryId(category.id)}>
                    {category.name}
                  </Chip>
                ))}
                <Chip active={false} onClick={() => setSheet({ kind: "settings" })}>
                  Edit
                </Chip>
              </div>

              {!lib.ready ? (
                <p className="px-4 text-muted">Opening your shelf…</p>
              ) : lib.error ? (
                <p className="px-4 text-muted">{lib.error}</p>
              ) : lib.clips.length === 0 ? (
                <EmptyShelf onImport={openImport} onSamples={() => void lib.addSamples()} busy={Boolean(lib.busy)} />
              ) : flat.length === 0 ? (
                <p className="px-4 text-muted">Nothing matches.</p>
              ) : (
                <div className="flex flex-col gap-6 px-4">
                  {sections.map((section) => (
                    <section key={section.key}>
                      {section.name && <h2 className="mb-3 font-display text-2xl">{section.name}</h2>}
                      <div className={lib.prefs.layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2"}>
                        {section.clips.map((clip) => (
                          <ClipCard
                            key={clip.id}
                            clip={clip}
                            layout={lib.prefs.layout}
                            cover={lib.prefs.covers ? lib.posterUrl(clip.id) : undefined}
                            category={categoryName(clip.categoryId)}
                            order={selecting ? selected.indexOf(clip.id) + 1 : 0}
                            onOpen={() => {
                              if (selecting) toggleSelected(clip.id);
                              else playIds(flat.map((item) => item.id), flat.findIndex((item) => item.id === clip.id), "This list");
                            }}
                            onLong={() => {
                              if (!selecting) {
                                setSelecting(true);
                                setSelected([clip.id]);
                              } else toggleSelected(clip.id);
                            }}
                            onMore={() => setSheet({ kind: "clip", id: clip.id })}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}

          {screen.kind === "playlists" && (
            <PlaylistIndex
              playlists={lib.playlists}
              onOpen={(id) => setScreen({ kind: "playlist", id })}
              onCreate={() => setSheet({ kind: "new-playlist" })}
            />
          )}

          {screen.kind === "playlist" && openPlaylist && (
            <PlaylistDetail
              playlist={openPlaylist}
              byId={byId}
              posterUrl={lib.posterUrl}
              covers={lib.prefs.covers}
              onBack={() => setScreen({ kind: "playlists" })}
              onPlay={(index) =>
                playIds(
                  openPlaylist.clipIds,
                  index,
                  openPlaylist.name,
                )
              }
              onRename={() => setSheet({ kind: "rename-playlist", id: openPlaylist.id })}
              onDelete={() => setSheet({ kind: "delete-playlist", id: openPlaylist.id })}
              onRemove={(clipId) => void lib.removeFromPlaylist(openPlaylist.id, clipId)}
              onMove={(clipId, dir) => void lib.moveInPlaylist(openPlaylist.id, clipId, dir)}
            />
          )}
        </main>
      </div>

      {selecting && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pt-3">
          <div className="mx-auto flex max-w-lg items-center justify-between pb-2">
            <p className="text-sm text-muted">{selected.length} selected · numbered in pick order</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="h-11 rounded-full px-3 text-sm"
                onClick={() => setSelected(flat.map((clip) => clip.id))}
              >
                All
              </button>
              <button type="button" className="h-11 rounded-full px-3 text-sm" onClick={exitSelect}>
                Done
              </button>
            </div>
          </div>
          <div className="mx-auto grid max-w-lg grid-cols-4 gap-2 pb-3">
            <button type="button" className={btn("primary")} disabled={!selected.length} onClick={() => playIds(selected, 0, "Your selection")}>
              Play
            </button>
            <button type="button" className={btn("ghost")} disabled={!selected.length} onClick={() => setSheet({ kind: "categorize", ids: selected })}>
              Category
            </button>
            <button type="button" className={btn("ghost")} disabled={!selected.length} onClick={() => setSheet({ kind: "to-playlist", ids: selected })}>
              Playlist
            </button>
            <button type="button" className={btn("danger")} disabled={!selected.length} aria-label="Remove" onClick={() => setSheet({ kind: "delete", ids: selected })}>
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      )}

      {!selecting && !player && screen.kind === "library" && (
        <button
          type="button"
          className="fixed right-4 bottom-5 z-30 grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-none lg:hidden"
          onClick={openImport}
          aria-label="Import videos"
          data-testid="import"
        >
          <Plus className="size-7" />
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="video/*,.mkv,.mov,.m4v,.avi"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length) void lib.importFiles(files);
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-30 grid place-items-center bg-bg/80">
          <p className="font-display text-3xl">Drop videos</p>
        </div>
      )}

      {sheet && (
        <SheetFrame title={sheetTitle(sheet, byId, lib.playlists, lib.categories)} onClose={() => setSheet(null)}>
          {sheet.kind === "sort" && (
            <div className="flex flex-col gap-2">
              {SORTS.map((item) => {
                const active = lib.prefs.sort === item.sort && lib.prefs.sortDir === item.sortDir;
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={choice(active)}
                    onClick={() => {
                      void lib.updatePrefs({ sort: item.sort, sortDir: item.sortDir });
                      setSheet(null);
                    }}
                  >
                    {item.label}
                    {active && <Check className="size-5" />}
                  </button>
                );
              })}
              <button
                type="button"
                className={choice(lib.prefs.group)}
                onClick={() => void lib.updatePrefs({ group: !lib.prefs.group })}
              >
                Group by category
                {lib.prefs.group && <Check className="size-5" />}
              </button>
            </div>
          )}

          {sheet.kind === "settings" && (
            <SettingsSheet onDeleteCategory={(id) => setSheet({ kind: "delete-category", id })} />
          )}

          {sheet.kind === "clip" && byId.get(sheet.id) && (
            <div className="flex flex-col gap-2">
              <button type="button" className={choice(false)} onClick={() => setSheet({ kind: "rename", id: sheet.id })}>
                Rename
              </button>
              <button type="button" className={choice(false)} onClick={() => setSheet({ kind: "categorize", ids: [sheet.id] })}>
                Category
              </button>
              <button type="button" className={choice(false)} onClick={() => setSheet({ kind: "to-playlist", ids: [sheet.id] })}>
                Add to playlist
              </button>
              <button type="button" className={btn("danger")} onClick={() => setSheet({ kind: "delete", ids: [sheet.id] })}>
                Remove from Nightbox
              </button>
            </div>
          )}

          {sheet.kind === "rename" && (
            <NameForm
              initial={byId.get(sheet.id)?.name ?? ""}
              action="Save name"
              autoFocus
              onSubmit={(name) => {
                void lib.renameClip(sheet.id, name);
                setSheet(null);
              }}
            />
          )}

          {sheet.kind === "rename-playlist" && (
            <NameForm
              initial={lib.playlists.find((playlist) => playlist.id === sheet.id)?.name ?? ""}
              action="Save name"
              autoFocus
              onSubmit={(name) => {
                void lib.renamePlaylist(sheet.id, name);
                setSheet(null);
              }}
            />
          )}

          {sheet.kind === "categorize" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={choice(false)}
                onClick={() => {
                  void lib.moveToCategory(sheet.ids, null);
                  setSheet(null);
                  exitSelect();
                }}
              >
                No category
              </button>
              {sortedCategories(lib.categories).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={choice(false)}
                  onClick={() => {
                    void lib.moveToCategory(sheet.ids, category.id);
                    setSheet(null);
                    exitSelect();
                  }}
                >
                  {category.name}
                </button>
              ))}
              <NameForm
                initial=""
                action="Create category"
                placeholder="New category"
                onSubmit={(name) => {
                  void lib.createCategory(name).then((id) => {
                    if (id) void lib.moveToCategory(sheet.ids, id);
                  });
                  setSheet(null);
                  exitSelect();
                }}
              />
            </div>
          )}

          {sheet.kind === "to-playlist" && (
            <div className="flex flex-col gap-2">
              {lib.playlists.length === 0 && <p className="text-sm text-muted">No playlists yet.</p>}
              {[...lib.playlists].sort((a, b) => b.createdAt - a.createdAt).map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className={choice(false)}
                  onClick={() => {
                    void lib.addToPlaylist(playlist.id, sheet.ids);
                    setSheet(null);
                    exitSelect();
                    lib.dismissNote();
                    setScreen({ kind: "playlist", id: playlist.id });
                  }}
                >
                  <span className="truncate">{playlist.name}</span>
                  <ListVideo className="size-4 text-muted" />
                </button>
              ))}
              <NameForm
                initial=""
                action="Create playlist"
                placeholder="New playlist"
                onSubmit={(name) => {
                  void lib.createPlaylist(name, sheet.ids).then((id) => {
                    if (id) setScreen({ kind: "playlist", id });
                  });
                  setSheet(null);
                  exitSelect();
                }}
              />
            </div>
          )}

          {sheet.kind === "new-playlist" && (
            <NameForm
              initial=""
              action="Create playlist"
              placeholder="Playlist name"
              autoFocus
              onSubmit={(name) => {
                void lib.createPlaylist(name).then((id) => {
                  if (id) setScreen({ kind: "playlist", id });
                });
                setSheet(null);
              }}
            />
          )}

          {sheet.kind === "delete" && (
            <Confirm
              body={
                sheet.ids.length === 1
                  ? "Removes it from Nightbox only. The original stays in your camera roll."
                  : `Removes ${sheet.ids.length} videos from Nightbox only. Originals stay in your camera roll.`
              }
              action="Remove"
              onConfirm={() => {
                void lib.removeClips(sheet.ids);
                setSheet(null);
                exitSelect();
              }}
            />
          )}

          {sheet.kind === "delete-category" && (
            <Confirm
              body="Videos in this category stay in the library. They just won't be grouped under this name."
              action="Delete category"
              onConfirm={() => {
                void lib.removeCategory(sheet.id);
                if (categoryId === sheet.id) setCategoryId("all");
                setSheet(null);
              }}
            />
          )}

          {sheet.kind === "delete-playlist" && (
            <Confirm
              body="The playlist goes away. The videos stay in your library."
              action="Delete playlist"
              onConfirm={() => {
                void lib.removePlaylist(sheet.id);
                setSheet(null);
                setScreen({ kind: "playlists" });
              }}
            />
          )}
        </SheetFrame>
      )}

      {player && liveQueue.length > 0 && (
        <Player
          queue={liveQueue}
          index={playerIndex}
          queueLabel={player.label}
          showHint={lib.prefs.showHint}
          onIndex={(index) => setPlayer({ ...player, index })}
          onClose={() => setPlayer(null)}
          onRename={(id) => setSheet({ kind: "rename", id })}
          onDismissHint={() => void lib.updatePrefs({ showHint: false })}
          getBlob={lib.getBlob}
        />
      )}
    </div>
  );
}

function SettingsSheet({ onDeleteCategory }: { onDeleteCategory: (id: string) => void }) {
  const lib = useLibrary();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={lib.prefs.covers}
        className={choice(false)}
        onClick={() => void lib.updatePrefs({ covers: !lib.prefs.covers })}
      >
        Show covers
        <span className="text-accent">{lib.prefs.covers ? "On" : "Off"}</span>
      </button>
      <div>
        <p className="mb-2 text-sm text-muted">Categories</p>
        {lib.categories.length === 0 && <p className="mb-2 text-sm text-muted">None yet. Create one below.</p>}
        <div className="flex flex-col gap-2">
          {sortedCategories(lib.categories).map((category) => (
            <div key={category.id} className="flex items-center gap-2">
              <input
                value={drafts[category.id] ?? category.name}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [category.id]: event.target.value }))}
                className={fieldClass}
                aria-label={`Rename ${category.name}`}
              />
              <button
                type="button"
                className={iconBtn}
                aria-label={`Save ${category.name}`}
                onClick={() => void lib.renameCategory(category.id, drafts[category.id] ?? category.name)}
              >
                <Check className="size-5" />
              </button>
              <button
                type="button"
                className={iconBtn}
                aria-label={`Delete ${category.name}`}
                onClick={() => onDeleteCategory(category.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <NameForm
        initial=""
        action="Add category"
        placeholder="New category"
        onSubmit={(name) => void lib.createCategory(name)}
      />
      <p className="text-sm text-muted">
        Nightbox keeps copies here so the shelf still works after you leave. Nothing is uploaded. Removing a video does not touch the original file.
      </p>
    </div>
  );
}

function PlaylistIndex({
  playlists,
  onOpen,
  onCreate,
}: {
  playlists: Playlist[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const ordered = [...playlists].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="flex flex-col gap-3 px-4">
      <button type="button" className={btn("primary")} onClick={onCreate}>
        <Plus className="size-5" />
        New playlist
      </button>
      {ordered.length === 0 ? (
        <p className="text-muted">Playlists are just an order you choose. Select videos, then add them here.</p>
      ) : (
        ordered.map((playlist) => (
          <button key={playlist.id} type="button" className={choice(false)} onClick={() => onOpen(playlist.id)}>
            <span className="min-w-0 flex-1 truncate text-left">{playlist.name}</span>
            <span className="text-sm text-muted">{playlist.clipIds.length}</span>
          </button>
        ))
      )}
    </div>
  );
}

function PlaylistDetail({
  playlist,
  byId,
  posterUrl,
  covers,
  onBack,
  onPlay,
  onRename,
  onDelete,
  onRemove,
  onMove,
}: {
  playlist: Playlist;
  byId: Map<string, ClipMeta>;
  posterUrl: (id: string) => string | undefined;
  covers: boolean;
  onBack: () => void;
  onPlay: (index: number) => void;
  onRename: () => void;
  onDelete: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const clips = playlist.clipIds.map((id) => byId.get(id)).filter((clip): clip is ClipMeta => Boolean(clip));
  return (
    <div className="flex flex-col gap-3 px-4">
      <div className="flex items-center gap-2">
        <button type="button" className={iconBtn} onClick={onBack} aria-label="Back to playlists">
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="min-w-0 flex-1 truncate font-display text-3xl">{playlist.name}</h2>
        <button type="button" className="h-11 rounded-full px-3 text-sm text-accent" onClick={onRename}>
          Rename
        </button>
      </div>
      <button type="button" className={btn("primary")} disabled={!clips.length} onClick={() => onPlay(0)}>
        Play in this order
      </button>
      {clips.length === 0 ? (
        <p className="text-muted">Nothing in this playlist. Select videos in the library, then choose Playlist.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clips.map((clip, index) => (
            <li key={clip.id} className="flex items-center gap-2 rounded-2xl bg-surface p-2">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onPlay(index)}>
                <Cover src={covers ? posterUrl(clip.id) : undefined} className="h-14 w-24" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{clip.name}</span>
                  <span className="text-sm text-muted">{formatTime(clip.duration)}</span>
                </span>
              </button>
              <button type="button" className={iconBtn} aria-label="Move earlier" disabled={index === 0} onClick={() => onMove(clip.id, -1)}>
                <ChevronUp className="size-5" />
              </button>
              <button type="button" className={iconBtn} aria-label="Move later" disabled={index === clips.length - 1} onClick={() => onMove(clip.id, 1)}>
                <ChevronDown className="size-5" />
              </button>
              <button type="button" className={iconBtn} aria-label="Remove from playlist" onClick={() => onRemove(clip.id)}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={btn("danger")} onClick={onDelete}>
        Delete playlist
      </button>
    </div>
  );
}

function ClipCard({
  clip,
  layout,
  cover,
  category,
  order,
  onOpen,
  onLong,
  onMore,
}: {
  clip: ClipMeta;
  layout: "grid" | "list";
  cover?: string;
  category: string;
  order: number;
  onOpen: () => void;
  onLong: () => void;
  onMore: () => void;
}) {
  const timer = useRef<number | null>(null);
  const long = useRef(false);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    long.current = false;
    moved.current = false;
    start.current = { x: event.clientX, y: event.clientY };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      long.current = true;
      onLong();
    }, 420);
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 12) {
      moved.current = true;
      if (timer.current) window.clearTimeout(timer.current);
    }
  }

  function up() {
    if (timer.current) window.clearTimeout(timer.current);
    if (!long.current && !moved.current) onOpen();
  }

  const selected = order > 0;
  return (
    <div className={`relative ${selected ? "rounded-2xl ring-2 ring-accent" : ""}`} data-testid="clip-card">
      <div
        role="button"
        tabIndex={0}
        className="w-full text-left select-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          if (timer.current) window.clearTimeout(timer.current);
        }}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "Enter") onOpen();
        }}
      >
        {layout === "grid" ? (
          <>
            <Cover src={cover} className="aspect-video w-full">
              {selected && <Order n={order} />}
              <span className="absolute right-2 bottom-2 rounded-md bg-bg px-1.5 py-0.5 text-xs text-fg tabular-nums">
                {formatTime(clip.duration)}
              </span>
            </Cover>
            <div className="px-1 pt-2 pr-12 pb-1">
              <p className="truncate font-medium">{clip.name}</p>
              <p className="truncate text-sm text-muted">{category}</p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-14">
            <Cover src={cover} className="h-16 w-28">
              {selected && <Order n={order} />}
            </Cover>
            <span className="min-w-0">
              <span className="block truncate font-medium">{clip.name}</span>
              <span className="block truncate text-sm text-muted">
                {category} · {formatTime(clip.duration)} · {formatBytes(clip.size)}
              </span>
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        className="absolute right-1 bottom-1 grid size-11 place-items-center rounded-full text-muted"
        aria-label={`Actions for ${clip.name}`}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onMore();
        }}
      >
        <MoreHorizontal className="size-5" />
      </button>
    </div>
  );
}

function Cover({ src, className, children }: { src?: string; className: string; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-surface-2 ${className}`}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <Film className="size-6 text-accent" />
        </div>
      )}
      {children}
    </div>
  );
}

function Order({ n }: { n: number }) {
  return (
    <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-accent text-sm font-medium text-accent-fg">
      {n}
    </span>
  );
}

function EmptyShelf({ onImport, onSamples, busy }: { onImport: () => void; onSamples: () => void; busy: boolean }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 pt-6" data-testid="empty">
      <div className="grid size-20 place-items-center rounded-2xl border border-border bg-surface">
        <Film className="size-9 text-accent" strokeWidth={1.5} />
      </div>
      <h2 className="font-display text-4xl">Nothing here yet</h2>
      <p className="text-muted">
        Import videos from this phone or tablet. Nightbox keeps them on the device. They are not uploaded.
      </p>
      <button type="button" className={btn("primary")} onClick={onImport} data-testid="import-empty">
        <Plus className="size-5" />
        Import videos
      </button>
      <button type="button" className={btn("ghost")} onClick={onSamples} disabled={busy}>
        Try the player with samples
      </button>
      <p className="text-sm text-muted">MP4 and MOV from a phone work best. Tap a video to play through the list. Select a few when you want your own order.</p>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <Film className="size-6 text-accent" strokeWidth={1.75} />
      <h1 className="font-display text-3xl italic leading-none">Nightbox</h1>
    </div>
  );
}

function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="sheet-panel safe-bottom w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface px-4 pt-3 sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{title}</h2>
          <button type="button" className={iconBtn} onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}

function NameForm({
  initial,
  action,
  placeholder,
  autoFocus,
  onSubmit,
}: {
  initial: string;
  action: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) onSubmit(name);
      }}
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={placeholder ?? "Name"}
        maxLength={80}
        autoFocus={autoFocus}
        className={fieldClass}
        aria-label={placeholder ?? "Name"}
      />
      <button type="submit" className={btn("primary")} disabled={!name.trim()}>
        {action}
      </button>
    </form>
  );
}

function Confirm({ body, action, onConfirm }: { body: string; action: string; onConfirm: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted">{body}</p>
      <button type="button" className={btn("danger")} onClick={onConfirm}>
        {action}
      </button>
    </div>
  );
}

function SideButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left ${active ? "bg-accent text-accent-fg" : "text-fg"}`}
    >
      {children}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 shrink-0 rounded-full px-4 ${active ? "bg-accent text-accent-fg" : "bg-surface text-fg"}`}
    >
      {children}
    </button>
  );
}

function ToolbarButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-11 shrink-0 rounded-full bg-surface px-4">
      {children}
    </button>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full flex-1 rounded-xl font-medium ${active ? "bg-surface-2 text-fg" : "text-muted"}`}
    >
      {children}
    </button>
  );
}

function sortedCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

function sheetTitle(sheet: Sheet, byId: Map<string, ClipMeta>, playlists: Playlist[], categories: Category[]): string {
  switch (sheet.kind) {
    case "sort":
      return "Sort";
    case "settings":
      return "Shelf";
    case "clip":
      return byId.get(sheet.id)?.name ?? "Video";
    case "rename":
      return "Rename";
    case "rename-playlist":
      return "Rename playlist";
    case "categorize":
      return "Category";
    case "to-playlist":
      return "Add to playlist";
    case "new-playlist":
      return "New playlist";
    case "delete":
      return "Remove";
    case "delete-category":
      return categories.find((category) => category.id === sheet.id)?.name ?? "Category";
    case "delete-playlist":
      return playlists.find((playlist) => playlist.id === sheet.id)?.name ?? "Playlist";
  }
}

const btn = (kind: "primary" | "ghost" | "danger") => {
  const base = "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-medium disabled:opacity-40";
  if (kind === "primary") return `${base} bg-accent text-accent-fg`;
  if (kind === "danger") return `${base} border border-danger text-danger`;
  return `${base} bg-surface-2 text-fg`;
};

const iconBtn = "grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-fg disabled:opacity-40";
const fieldClass = "h-12 w-full rounded-2xl border border-border bg-bg px-3 text-base text-fg outline-none placeholder:text-muted";
const choice = (active: boolean) =>
  `flex h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left ${active ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg"}`;
