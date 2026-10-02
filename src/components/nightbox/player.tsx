import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pause, Play, X } from "lucide-react";
import type { ClipMeta } from "@/lib/library-db";
import { formatTime } from "@/lib/library-view";

type PlayerProps = {
  queue: ClipMeta[];
  index: number;
  queueLabel: string;
  showHint: boolean;
  onIndex: (index: number) => void;
  onClose: () => void;
  onRename: (id: string) => void;
  onDismissHint: () => void;
  getBlob: (id: string) => Promise<Blob | undefined>;
};

const JUMP = 10;

export function Player({
  queue,
  index,
  queueLabel,
  showHint,
  onIndex,
  onClose,
  onRename,
  onDismissHint,
  getBlob,
}: PlayerProps) {
  const clip = queue[index];
  const nextClip = queue[index + 1];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const getBlobRef = useRef(getBlob);
  getBlobRef.current = getBlob;
  const [src, setSrc] = useState<string | undefined>();
  const [phase, setPhase] = useState<"loading" | "ready" | "missing">("loading");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const [rate, setRate] = useState(1);
  const [loopAll, setLoopAll] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [flash, setFlash] = useState<{ label: string; dir: "l" | "r" } | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!clip) return;
    let cancel = false;
    let url: string | null = null;
    setSrc(undefined);
    setPhase("loading");
    setTime(0);
    setDuration(clip.duration || 0);
    setAtEnd(false);
    setPlaying(false);
    getBlobRef
      .current(clip.id)
      .then((blob) => {
        if (cancel) return;
        if (!blob) {
          setPhase("missing");
          return;
        }
        url = URL.createObjectURL(blob);
        if (cancel) {
          URL.revokeObjectURL(url);
          return;
        }
        setSrc(url);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancel) setPhase("missing");
      });
    return () => {
      cancel = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [clip]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    video.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
  }, [rate, src]);

  function showFlash(delta: number) {
    const label = `${delta > 0 ? "+" : "−"}${Math.abs(delta)}s`;
    setFlash({ label, dir: delta > 0 ? "r" : "l" });
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 520);
  }

  function seekBy(delta: number) {
    const video = videoRef.current;
    if (!video) return;
    const length = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration;
    const next = Math.min(Math.max(0, video.currentTime + delta), length || video.currentTime + delta);
    video.currentTime = next;
    setTime(next);
    setAtEnd(false);
    showFlash(delta);
  }

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setAtEnd(false);
      video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }

  function go(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= queue.length) return;
    onIndex(nextIndex);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea")) return;
      if (event.key === "Escape") onClose();
      if (event.key === " " || event.key === "k") {
        event.preventDefault();
        toggle();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        seekBy(event.shiftKey ? 5 : JUMP);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekBy(event.shiftKey ? -5 : -JUMP);
      }
      if (event.key === "n" || event.key === "ArrowDown") go(index + 1);
      if (event.key === "p" || event.key === "ArrowUp") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!clip) return null;

  const length = duration || clip.duration || 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg text-fg" data-testid="player">
      <header className="safe-top flex shrink-0 items-center gap-2 px-2 pt-2">
        <button type="button" className={iconBtn} onClick={onClose} aria-label="Close player">
          <X className="size-5" />
        </button>
        <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onRename(clip.id)}>
          <span className="block truncate text-base font-medium">{clip.name}</span>
          <span className="block truncate text-sm text-muted">
            {queueLabel} · {index + 1} of {queue.length}
            {nextClip ? ` · Next ${nextClip.name}` : ""}
          </span>
        </button>
        <button type="button" className="h-11 shrink-0 rounded-full px-3 text-sm text-accent" onClick={() => onRename(clip.id)}>
          Rename
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          className="h-full w-full bg-bg object-contain"
          src={src}
          playsInline
          preload="auto"
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const next = event.currentTarget.duration;
            setDuration(Number.isFinite(next) && next > 0 ? next : clip.duration);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            if (index < queue.length - 1) onIndex(index + 1);
            else if (loopAll) {
              if (queue.length === 1) {
                const video = videoRef.current;
                if (!video) return;
                video.currentTime = 0;
                video.play().catch(() => setPlaying(false));
              } else onIndex(0);
            } else setAtEnd(true);
          }}
        />
        <GestureLayer onSeek={seekBy} onToggle={toggle} />
        {phase === "loading" && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-muted">Opening…</p>
        )}
        {phase === "missing" && (
          <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-muted">
            This file is in the library, but it won't play in this browser.
          </p>
        )}
        {!playing && phase === "ready" && !atEnd && (
          <button
            type="button"
            className="absolute top-1/2 left-1/2 z-20 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-accent-fg"
            onClick={toggle}
            aria-label="Play"
          >
            <Play className="size-8 fill-current" />
          </button>
        )}
        {flash && (
          <div
            className={`pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 ${flash.dir === "l" ? "left-6" : "right-6"}`}
          >
            <span className="seek-pop rounded-full bg-surface px-4 py-2 font-display text-2xl">{flash.label}</span>
          </div>
        )}
        {atEnd && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-bg/90 px-6 text-center">
            <p className="font-display text-3xl">That's the end</p>
            <button
              type="button"
              className={primaryBtn}
              onClick={() => {
                if (index === 0) {
                  const video = videoRef.current;
                  setAtEnd(false);
                  if (video) {
                    video.currentTime = 0;
                    video.play().catch(() => setPlaying(false));
                  }
                } else onIndex(0);
              }}
            >
              Play from the start
            </button>
            <button type="button" className={ghostBtn} onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>

      <footer className="safe-bottom mx-auto w-full max-w-lg shrink-0 px-4 pt-1">
        {showHint && (
          <button type="button" className="mb-1 w-full text-left text-sm text-muted" onClick={onDismissHint}>
            Tap the sides to skip 10 seconds. Hold to keep going. Tap here to hide.
          </button>
        )}
        <div className="flex items-center gap-3 tabular-nums text-sm text-muted">
          <span className="w-12">{formatTime(time)}</span>
          <input
            className="scrub"
            type="range"
            min={0}
            max={length || 0}
            step={0.1}
            value={Math.min(time, length || 0)}
            aria-label="Position in the video"
            onChange={(event) => {
              const next = Number(event.target.value);
              const video = videoRef.current;
              if (video) video.currentTime = next;
              setTime(next);
              setAtEnd(false);
            }}
          />
          <span className="w-12 text-right">{formatTime(length)}</span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2">
          <button type="button" className={ghostBtn} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous video">
            Prev
          </button>
          <SeekButton label="−10" delta={-JUMP} onSeek={seekBy} testId="seek-back" />
          <button type="button" className={primaryBtn} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </button>
          <SeekButton label="+10" delta={JUMP} onSeek={seekBy} testId="seek-forward" />
          <button
            type="button"
            className={ghostBtn}
            onClick={() => go(index + 1)}
            disabled={index >= queue.length - 1 && !loopAll}
            aria-label="Next video"
          >
            Next
          </button>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2 pb-3">
          <SeekButton label="−5" delta={-5} onSeek={seekBy} />
          <SeekButton label="+5" delta={5} onSeek={seekBy} />
          <SeekButton label="+30" delta={30} onSeek={seekBy} />
          <button
            type="button"
            className={ghostBtn}
            onClick={() => setRate((value) => (value === 1 ? 1.25 : value === 1.25 ? 1.5 : value === 1.5 ? 2 : 1))}
            aria-label="Playback speed"
          >
            {rate === 1 ? "1×" : `${rate}×`}
          </button>
          <button type="button" className={ghostBtn} onClick={() => setQueueOpen(true)} aria-label="Show queue">
            Queue
          </button>
        </div>
      </footer>

      {queueOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70" onClick={() => setQueueOpen(false)}>
          <div
            role="dialog"
            aria-label="Queue"
            className="queue-panel safe-bottom w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface px-4 pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl">Queue</h2>
              <button type="button" className={iconBtn} onClick={() => setQueueOpen(false)} aria-label="Close queue">
                <X className="size-5" />
              </button>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={loopAll}
              className="mb-3 flex h-12 w-full items-center justify-between rounded-2xl bg-surface-2 px-4"
              onClick={() => setLoopAll((value) => !value)}
            >
              <span>Repeat the queue</span>
              <span className={`grid h-7 w-12 place-items-center rounded-full ${loopAll ? "bg-accent" : "bg-border"}`}>
                <span className={`size-5 rounded-full bg-fg ${loopAll ? "translate-x-2" : "-translate-x-2"}`} />
              </span>
            </button>
            <ul className="flex flex-col gap-2 pb-4">
              {queue.map((item, itemIndex) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`flex h-14 w-full items-center gap-3 rounded-2xl px-3 text-left ${itemIndex === index ? "bg-accent text-accent-fg" : "bg-surface-2"}`}
                    onClick={() => {
                      onIndex(itemIndex);
                      setQueueOpen(false);
                      setAtEnd(false);
                    }}
                  >
                    <span className="w-6 tabular-nums">{itemIndex + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="text-sm opacity-80">{formatTime(item.duration)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function GestureLayer({ onSeek, onToggle }: { onSeek: (delta: number) => void; onToggle: () => void }) {
  const hold = useRef<number | null>(null);
  const repeat = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0, zone: "c" as "l" | "c" | "r", held: false, moved: false });

  function clear() {
    if (hold.current) window.clearTimeout(hold.current);
    if (repeat.current) window.clearInterval(repeat.current);
    hold.current = null;
    repeat.current = null;
  }

  function zoneOf(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    if (x < 0.3) return "l" as const;
    if (x > 0.7) return "r" as const;
    return "c" as const;
  }

  return (
    <div
      className="gesture-layer absolute inset-0 z-10"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        const zone = zoneOf(event);
        start.current = { x: event.clientX, y: event.clientY, zone, held: false, moved: false };
        clear();
        if (zone === "c") return;
        const delta = zone === "l" ? -JUMP : JUMP;
        hold.current = window.setTimeout(() => {
          start.current.held = true;
          onSeek(delta);
          repeat.current = window.setInterval(() => onSeek(delta), 180);
        }, 360);
      }}
      onPointerMove={(event) => {
        if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 14) {
          start.current.moved = true;
          clear();
        }
      }}
      onPointerUp={(event) => {
        clear();
        if (start.current.held || start.current.moved) return;
        const zone = zoneOf(event);
        if (zone === "c") onToggle();
        else onSeek(zone === "l" ? -JUMP : JUMP);
      }}
      onPointerCancel={clear}
    />
  );
}

function SeekButton({
  label,
  delta,
  onSeek,
  testId,
}: {
  label: string;
  delta: number;
  onSeek: (delta: number) => void;
  testId?: string;
}) {
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const held = useRef(false);
  const skipClick = useRef(false);

  function stop() {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }

  return (
    <button
      type="button"
      className={ghostBtn}
      data-testid={testId}
      aria-label={`Jump ${label} seconds`}
      onPointerDown={() => {
        held.current = false;
        stop();
        timeoutRef.current = window.setTimeout(() => {
          held.current = true;
          onSeek(delta);
          intervalRef.current = window.setInterval(() => onSeek(delta), 180);
        }, 320);
      }}
      onPointerUp={() => {
        stop();
        skipClick.current = true;
        if (!held.current) onSeek(delta);
      }}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        if (skipClick.current) {
          skipClick.current = false;
          return;
        }
        onSeek(delta);
      }}
    >
      {label}
    </button>
  );
}

const iconBtn = "grid size-12 place-items-center rounded-full text-fg";
const primaryBtn =
  "inline-flex h-14 w-full items-center justify-center rounded-2xl bg-accent px-3 font-medium text-accent-fg disabled:opacity-40";
const ghostBtn =
  "inline-flex h-14 w-full items-center justify-center rounded-2xl bg-surface-2 px-1 text-sm font-medium text-fg disabled:opacity-40";
