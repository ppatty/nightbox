import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { _ as Check, a as Search, c as Pause, d as LayoutGrid, f as Film, g as ChevronDown, h as ChevronLeft, i as Settings, l as List, m as ChevronUp, o as Plus, p as Ellipsis, r as Trash2, s as Play, t as X, u as ListVideo } from "../_libs/lucide-react.mjs";
import { t as openDB } from "../_libs/idb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DeP5JTqt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DEFAULT_PREFS = {
	sort: "added",
	sortDir: "desc",
	group: false,
	layout: "grid",
	covers: true,
	showHint: true
};
var dbPromise = null;
function database() {
	if (typeof indexedDB === "undefined") return Promise.reject(/* @__PURE__ */ new Error("This browser can't store a library."));
	if (!dbPromise) dbPromise = openDB("nightbox", 1, { upgrade(db) {
		if (!db.objectStoreNames.contains("clips")) db.createObjectStore("clips", { keyPath: "id" });
		if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
		if (!db.objectStoreNames.contains("posters")) db.createObjectStore("posters");
		if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" });
		if (!db.objectStoreNames.contains("playlists")) db.createObjectStore("playlists", { keyPath: "id" });
		if (!db.objectStoreNames.contains("prefs")) db.createObjectStore("prefs");
	} }).catch((err) => {
		dbPromise = null;
		throw err;
	});
	return dbPromise;
}
function uid() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function normalizePrefs(value) {
	return {
		...DEFAULT_PREFS,
		...value
	};
}
async function loadLibrary() {
	const db = await database();
	const [clips, categories, playlists, stored] = await Promise.all([
		db.getAll("clips"),
		db.getAll("categories"),
		db.getAll("playlists"),
		db.get("prefs", "main")
	]);
	const posters = [];
	const tx = db.transaction("posters");
	let cursor = await tx.store.openCursor();
	while (cursor) {
		posters.push({
			id: String(cursor.key),
			blob: cursor.value
		});
		cursor = await cursor.continue();
	}
	await tx.done;
	return {
		clips,
		categories,
		playlists,
		prefs: normalizePrefs(stored),
		posters
	};
}
async function savePrefs(prefs) {
	await (await database()).put("prefs", prefs, "main");
}
async function putClip(meta, blob, poster) {
	const tx = (await database()).transaction([
		"clips",
		"blobs",
		"posters"
	], "readwrite");
	await tx.objectStore("clips").put(meta);
	await tx.objectStore("blobs").put(blob, meta.id);
	if (poster) await tx.objectStore("posters").put(poster, meta.id);
	await tx.done;
}
async function renameClip(id, name) {
	const db = await database();
	const clip = await db.get("clips", id);
	if (!clip) return;
	await db.put("clips", {
		...clip,
		name
	});
}
async function setClipCategory(ids, categoryId) {
	const tx = (await database()).transaction("clips", "readwrite");
	for (const id of ids) {
		const clip = await tx.store.get(id);
		if (clip) await tx.store.put({
			...clip,
			categoryId
		});
	}
	await tx.done;
}
async function deleteClips(ids) {
	const drop = new Set(ids);
	const tx = (await database()).transaction([
		"clips",
		"blobs",
		"posters",
		"playlists"
	], "readwrite");
	for (const id of ids) {
		await tx.objectStore("clips").delete(id);
		await tx.objectStore("blobs").delete(id);
		await tx.objectStore("posters").delete(id);
	}
	const playlists = await tx.objectStore("playlists").getAll();
	for (const playlist of playlists) {
		const clipIds = playlist.clipIds.filter((id) => !drop.has(id));
		if (clipIds.length !== playlist.clipIds.length) await tx.objectStore("playlists").put({
			...playlist,
			clipIds
		});
	}
	await tx.done;
}
async function putCategory(category) {
	await (await database()).put("categories", category);
}
async function deleteCategory(id) {
	const tx = (await database()).transaction(["categories", "clips"], "readwrite");
	await tx.objectStore("categories").delete(id);
	const clips = await tx.objectStore("clips").getAll();
	for (const clip of clips) if (clip.categoryId === id) await tx.objectStore("clips").put({
		...clip,
		categoryId: null
	});
	await tx.done;
}
async function putPlaylist(playlist) {
	await (await database()).put("playlists", playlist);
}
async function deletePlaylist(id) {
	await (await database()).delete("playlists", id);
}
async function loadBlob(id) {
	return (await database()).get("blobs", id);
}
function isVideoFile(file) {
	if (file.type.startsWith("video/")) return true;
	return /\.(mp4|m4v|mov|webm|mkv|avi|ogv|ogg|3gp|3g2)$/i.test(file.name);
}
function prettyName(filename) {
	return filename.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || "Untitled";
}
function isQuotaError(err) {
	return err instanceof DOMException && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED");
}
async function askToPersist() {
	try {
		if (navigator.storage?.persist) await navigator.storage.persist();
	} catch {}
}
function capturePoster(file) {
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
		const finish = (duration, poster) => {
			if (settled) return;
			settled = true;
			URL.revokeObjectURL(url);
			video.removeAttribute("src");
			video.load();
			video.remove();
			resolve({
				duration,
				poster
			});
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
			canvas.toBlob((blob) => finish(duration, blob), "image/jpeg", .74);
		};
		const timer = window.setTimeout(draw, 2500);
		video.onerror = () => {
			window.clearTimeout(timer);
			finish(0, null);
		};
		video.onloadedmetadata = () => {
			const duration = Number.isFinite(video.duration) ? video.duration : 0;
			const target = duration > 0 ? Math.min(Math.max(duration * .08, .15), Math.max(duration - .05, 0)) : 0;
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
async function recordSample(title, hue) {
	if (typeof MediaRecorder === "undefined") throw new Error("This browser can't make sample clips.");
	const canvas = document.createElement("canvas");
	canvas.width = 640;
	canvas.height = 360;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Couldn't draw a sample clip.");
	const mime = [
		"video/mp4",
		"video/webm;codecs=vp8",
		"video/webm"
	].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
	if (!mime) throw new Error("This browser can't make sample clips.");
	const stream = canvas.captureStream(30);
	const rec = new MediaRecorder(stream, { mimeType: mime });
	const chunks = [];
	rec.ondataavailable = (event) => {
		if (event.data.size) chunks.push(event.data);
	};
	const stopped = new Promise((resolve) => {
		rec.onstop = () => resolve();
	});
	const durationMs = 3200;
	if (document.fonts?.ready) await document.fonts.ready.catch(() => void 0);
	rec.start();
	await new Promise((resolve) => {
		const start = performance.now();
		const tick = (now) => {
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
	const poster = await new Promise((resolve, reject) => {
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("No poster")), "image/jpeg", .82);
	});
	return {
		blob: new Blob(chunks, { type: mime }),
		poster,
		duration: durationMs / 1e3,
		mime
	};
}
var LibraryContext = (0, import_react.createContext)(null);
function useLibrary() {
	const value = (0, import_react.useContext)(LibraryContext);
	if (!value) throw new Error("Library is not ready");
	return value;
}
function cleanName(name) {
	return name.trim().slice(0, 80);
}
function LibraryProvider({ children }) {
	const [ready, setReady] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [clips, setClips] = (0, import_react.useState)([]);
	const [categories, setCategories] = (0, import_react.useState)([]);
	const [playlists, setPlaylists] = (0, import_react.useState)([]);
	const [prefs, setPrefs] = (0, import_react.useState)({
		sort: "added",
		sortDir: "desc",
		group: false,
		layout: "grid",
		covers: true,
		showHint: true
	});
	const [posters, setPosters] = (0, import_react.useState)({});
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [note, setNote] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let cancel = false;
		const created = [];
		loadLibrary().then((loaded) => {
			if (cancel) return;
			const urls = {};
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
		}).catch(() => {
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
	(0, import_react.useEffect)(() => {
		if (!note) return;
		const timer = window.setTimeout(() => setNote(null), 4200);
		return () => window.clearTimeout(timer);
	}, [note]);
	const posterUrl = (0, import_react.useCallback)((id) => posters[id], [posters]);
	const libraryBytes = (0, import_react.useMemo)(() => clips.reduce((sum, clip) => sum + clip.size, 0), [clips]);
	const rememberPoster = (0, import_react.useCallback)((id, poster) => {
		if (!poster) return;
		const url = URL.createObjectURL(poster);
		setPosters((prev) => {
			const previous = prev[id];
			if (previous) URL.revokeObjectURL(previous);
			return {
				...prev,
				[id]: url
			};
		});
	}, []);
	const importFiles = (0, import_react.useCallback)(async (files) => {
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
			const file = videos[i];
			setBusy(`Saving ${i + 1} of ${videos.length}`);
			try {
				const captured = await capturePoster(file);
				const meta = {
					id: uid(),
					name: prettyName(file.name),
					categoryId: null,
					addedAt: Date.now(),
					duration: captured.duration,
					size: file.size,
					mime: file.type || "video/mp4"
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
			setNote(saved ? `Saved ${saved}. This device filled up before the rest could be kept.` : "Not enough room on this device to keep that video in Nightbox.");
			return;
		}
		if (failed && saved) setNote(`Saved ${saved}. ${failed} couldn't be read.`);
		else if (failed) setNote("Couldn't read those videos.");
		else setNote(saved === 1 ? "Saved to this device." : `Saved ${saved} videos on this device.`);
	}, [rememberPoster]);
	const addSamples = (0, import_react.useCallback)(async () => {
		setBusy("Making sample clips");
		try {
			let category = categories.find((item) => item.name.toLowerCase() === "samples");
			if (!category) {
				category = {
					id: uid(),
					name: "Samples",
					createdAt: Date.now()
				};
				await putCategory(category);
				setCategories((prev) => [...prev, category]);
			}
			for (const spec of [
				{
					title: "Amber drift",
					hue: 32
				},
				{
					title: "Dusk line",
					hue: 16
				},
				{
					title: "Slow tide",
					hue: 198
				}
			]) {
				const made = await recordSample(spec.title, spec.hue);
				const meta = {
					id: uid(),
					name: spec.title,
					categoryId: category.id,
					addedAt: Date.now(),
					duration: made.duration,
					size: made.blob.size,
					mime: made.mime
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
	const renameClip$1 = (0, import_react.useCallback)(async (id, name) => {
		const next = cleanName(name);
		if (!next) return;
		await renameClip(id, next);
		setClips((prev) => prev.map((clip) => clip.id === id ? {
			...clip,
			name: next
		} : clip));
	}, []);
	const removeClips = (0, import_react.useCallback)(async (ids) => {
		if (!ids.length) return;
		await deleteClips(ids);
		const drop = new Set(ids);
		setClips((prev) => prev.filter((clip) => !drop.has(clip.id)));
		setPlaylists((prev) => prev.map((playlist) => ({
			...playlist,
			clipIds: playlist.clipIds.filter((id) => !drop.has(id))
		})));
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
	const moveToCategory = (0, import_react.useCallback)(async (ids, categoryId) => {
		await setClipCategory(ids, categoryId);
		const set = new Set(ids);
		setClips((prev) => prev.map((clip) => set.has(clip.id) ? {
			...clip,
			categoryId
		} : clip));
	}, []);
	const createCategory = (0, import_react.useCallback)(async (name) => {
		const next = cleanName(name);
		if (!next) return null;
		const category = {
			id: uid(),
			name: next,
			createdAt: Date.now()
		};
		await putCategory(category);
		setCategories((prev) => [...prev, category]);
		return category.id;
	}, []);
	const renameCategory = (0, import_react.useCallback)(async (id, name) => {
		const next = cleanName(name);
		if (!next) return;
		let updated = null;
		setCategories((prev) => prev.map((category) => {
			if (category.id !== id) return category;
			updated = {
				...category,
				name: next
			};
			return updated;
		}));
		if (updated) await putCategory(updated);
	}, []);
	const removeCategory = (0, import_react.useCallback)(async (id) => {
		await deleteCategory(id);
		setCategories((prev) => prev.filter((category) => category.id !== id));
		setClips((prev) => prev.map((clip) => clip.categoryId === id ? {
			...clip,
			categoryId: null
		} : clip));
	}, []);
	const createPlaylist = (0, import_react.useCallback)(async (name, clipIds = []) => {
		const next = cleanName(name);
		if (!next) return null;
		const playlist = {
			id: uid(),
			name: next,
			clipIds: [...new Set(clipIds)],
			createdAt: Date.now()
		};
		await putPlaylist(playlist);
		setPlaylists((prev) => [playlist, ...prev]);
		return playlist.id;
	}, []);
	const renamePlaylist = (0, import_react.useCallback)(async (id, name) => {
		const next = cleanName(name);
		if (!next) return;
		let updated = null;
		setPlaylists((prev) => prev.map((playlist) => {
			if (playlist.id !== id) return playlist;
			updated = {
				...playlist,
				name: next
			};
			return updated;
		}));
		if (updated) await putPlaylist(updated);
	}, []);
	const removePlaylist = (0, import_react.useCallback)(async (id) => {
		await deletePlaylist(id);
		setPlaylists((prev) => prev.filter((playlist) => playlist.id !== id));
	}, []);
	const addToPlaylist = (0, import_react.useCallback)(async (playlistId, clipIds) => {
		let updated = null;
		setPlaylists((prev) => prev.map((playlist) => {
			if (playlist.id !== playlistId) return playlist;
			const seen = new Set(playlist.clipIds);
			const extra = clipIds.filter((id) => !seen.has(id));
			updated = {
				...playlist,
				clipIds: [...playlist.clipIds, ...extra]
			};
			return updated;
		}));
		if (updated) await putPlaylist(updated);
	}, []);
	const removeFromPlaylist = (0, import_react.useCallback)(async (playlistId, clipId) => {
		let updated = null;
		setPlaylists((prev) => prev.map((playlist) => {
			if (playlist.id !== playlistId) return playlist;
			updated = {
				...playlist,
				clipIds: playlist.clipIds.filter((id) => id !== clipId)
			};
			return updated;
		}));
		if (updated) await putPlaylist(updated);
	}, []);
	const moveInPlaylist = (0, import_react.useCallback)(async (playlistId, clipId, dir) => {
		let updated = null;
		setPlaylists((prev) => prev.map((playlist) => {
			if (playlist.id !== playlistId) return playlist;
			const index = playlist.clipIds.indexOf(clipId);
			const target = index + dir;
			if (index < 0 || target < 0 || target >= playlist.clipIds.length) return playlist;
			const clipIds = [...playlist.clipIds];
			const [item] = clipIds.splice(index, 1);
			clipIds.splice(target, 0, item);
			updated = {
				...playlist,
				clipIds
			};
			return updated;
		}));
		if (updated) await putPlaylist(updated);
	}, []);
	const updatePrefs = (0, import_react.useCallback)(async (patch) => {
		let next = null;
		setPrefs((prev) => {
			next = {
				...prev,
				...patch
			};
			return next;
		});
		if (next) await savePrefs(next);
	}, []);
	const getBlob = (0, import_react.useCallback)((id) => loadBlob(id), []);
	const value = (0, import_react.useMemo)(() => ({
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
		renameClip: renameClip$1,
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
		dismissNote: () => setNote(null)
	}), [
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
		renameClip$1,
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
		getBlob
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryContext.Provider, {
		value,
		children
	});
}
function formatTime(seconds) {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor(total % 3600 / 60);
	const s = total % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	return `${m}:${String(s).padStart(2, "0")}`;
}
function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
	if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	if (bytes < 1073741824) {
		const mb = bytes / 1048576;
		return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
	}
	return `${(bytes / 1073741824).toFixed(2)} GB`;
}
var SORTS = [
	{
		sort: "added",
		sortDir: "desc",
		label: "Newest"
	},
	{
		sort: "added",
		sortDir: "asc",
		label: "Oldest"
	},
	{
		sort: "name",
		sortDir: "asc",
		label: "Name A–Z"
	},
	{
		sort: "name",
		sortDir: "desc",
		label: "Name Z–A"
	},
	{
		sort: "duration",
		sortDir: "desc",
		label: "Longest"
	},
	{
		sort: "duration",
		sortDir: "asc",
		label: "Shortest"
	},
	{
		sort: "size",
		sortDir: "desc",
		label: "Largest"
	}
];
function sortLabel(prefs) {
	return SORTS.find((item) => item.sort === prefs.sort && item.sortDir === prefs.sortDir)?.label ?? "Newest";
}
function visibleClips(clips, opts) {
	const query = opts.query.trim().toLowerCase();
	const list = clips.filter((clip) => {
		if (opts.categoryId !== "all" && clip.categoryId !== opts.categoryId) return false;
		if (query && !clip.name.toLowerCase().includes(query)) return false;
		return true;
	});
	const dir = opts.prefs.sortDir === "asc" ? 1 : -1;
	return [...list].sort((a, b) => {
		switch (opts.prefs.sort) {
			case "name": return a.name.localeCompare(b.name) * dir;
			case "duration": return (a.duration - b.duration) * dir;
			case "size": return (a.size - b.size) * dir;
			default: return (a.addedAt - b.addedAt) * dir;
		}
	});
}
function groupClips(clips, categories, enabled) {
	if (!enabled) return [{
		key: "all",
		name: "",
		clips
	}];
	const buckets = /* @__PURE__ */ new Map();
	for (const clip of clips) {
		const key = clip.categoryId ?? "";
		const existing = buckets.get(key);
		if (existing) existing.push(clip);
		else buckets.set(key, [clip]);
	}
	const sections = [];
	const ordered = [...categories].sort((a, b) => a.name.localeCompare(b.name));
	for (const category of ordered) {
		const list = buckets.get(category.id);
		if (list?.length) sections.push({
			key: category.id,
			name: category.name,
			clips: list
		});
	}
	const none = buckets.get("");
	if (none?.length) sections.push({
		key: "none",
		name: "No category",
		clips: none
	});
	return sections;
}
var JUMP = 10;
function Player({ queue, index, queueLabel, showHint, onIndex, onClose, onRename, onDismissHint, getBlob }) {
	const clip = queue[index];
	const nextClip = queue[index + 1];
	const videoRef = (0, import_react.useRef)(null);
	const getBlobRef = (0, import_react.useRef)(getBlob);
	getBlobRef.current = getBlob;
	const [src, setSrc] = (0, import_react.useState)();
	const [phase, setPhase] = (0, import_react.useState)("loading");
	const [playing, setPlaying] = (0, import_react.useState)(false);
	const [time, setTime] = (0, import_react.useState)(0);
	const [duration, setDuration] = (0, import_react.useState)(0);
	const [atEnd, setAtEnd] = (0, import_react.useState)(false);
	const [rate, setRate] = (0, import_react.useState)(1);
	const [loopAll, setLoopAll] = (0, import_react.useState)(false);
	const [queueOpen, setQueueOpen] = (0, import_react.useState)(false);
	const [flash, setFlash] = (0, import_react.useState)(null);
	const flashTimer = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!clip) return;
		let cancel = false;
		let url = null;
		setSrc(void 0);
		setPhase("loading");
		setTime(0);
		setDuration(clip.duration || 0);
		setAtEnd(false);
		setPlaying(false);
		getBlobRef.current(clip.id).then((blob) => {
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
		}).catch(() => {
			if (!cancel) setPhase("missing");
		});
		return () => {
			cancel = true;
			if (url) URL.revokeObjectURL(url);
		};
	}, [clip]);
	(0, import_react.useEffect)(() => {
		const video = videoRef.current;
		if (!video || !src) return;
		video.play().then(() => setPlaying(true), () => setPlaying(false));
	}, [src]);
	(0, import_react.useEffect)(() => {
		const video = videoRef.current;
		if (video) video.playbackRate = rate;
	}, [rate, src]);
	function showFlash(delta) {
		const label = `${delta > 0 ? "+" : "−"}${Math.abs(delta)}s`;
		setFlash({
			label,
			dir: delta > 0 ? "r" : "l"
		});
		if (flashTimer.current) window.clearTimeout(flashTimer.current);
		flashTimer.current = window.setTimeout(() => setFlash(null), 520);
	}
	function seekBy(delta) {
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
		} else video.pause();
	}
	function go(nextIndex) {
		if (nextIndex < 0 || nextIndex >= queue.length) return;
		onIndex(nextIndex);
	}
	(0, import_react.useEffect)(() => {
		function onKey(event) {
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
				seekBy(event.shiftKey ? -5 : -10);
			}
			if (event.key === "n" || event.key === "ArrowDown") go(index + 1);
			if (event.key === "p" || event.key === "ArrowUp") go(index - 1);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});
	if (!clip) return null;
	const length = duration || clip.duration || 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-40 flex flex-col bg-bg text-fg",
		"data-testid": "player",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "safe-top flex shrink-0 items-center gap-2 px-2 pt-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: iconBtn$1,
						onClick: onClose,
						"aria-label": "Close player",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "min-w-0 flex-1 truncate text-left",
						onClick: () => onRename(clip.id),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block truncate text-base font-medium",
							children: clip.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "block truncate text-sm text-muted",
							children: [
								queueLabel,
								" · ",
								index + 1,
								" of ",
								queue.length,
								nextClip ? ` · Next ${nextClip.name}` : ""
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-11 shrink-0 rounded-full px-3 text-sm text-accent",
						onClick: () => onRename(clip.id),
						children: "Rename"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative min-h-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						ref: videoRef,
						className: "h-full w-full bg-bg object-contain",
						src,
						playsInline: true,
						preload: "auto",
						onTimeUpdate: (event) => setTime(event.currentTarget.currentTime),
						onLoadedMetadata: (event) => {
							const next = event.currentTarget.duration;
							setDuration(Number.isFinite(next) && next > 0 ? next : clip.duration);
						},
						onPlay: () => setPlaying(true),
						onPause: () => setPlaying(false),
						onEnded: () => {
							if (index < queue.length - 1) onIndex(index + 1);
							else if (loopAll) {
								if (queue.length === 1) {
									const video = videoRef.current;
									if (!video) return;
									video.currentTime = 0;
									video.play().catch(() => setPlaying(false));
								} else onIndex(0);
							} else setAtEnd(true);
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GestureLayer, {
						onSeek: seekBy,
						onToggle: toggle
					}),
					phase === "loading" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "pointer-events-none absolute inset-0 grid place-items-center text-muted",
						children: "Opening…"
					}),
					phase === "missing" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-muted",
						children: "This file is in the library, but it won't play in this browser."
					}),
					!playing && phase === "ready" && !atEnd && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "absolute top-1/2 left-1/2 z-20 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-accent-fg",
						onClick: toggle,
						"aria-label": "Play",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-8 fill-current" })
					}),
					flash && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 ${flash.dir === "l" ? "left-6" : "right-6"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "seek-pop rounded-full bg-surface px-4 py-2 font-display text-2xl",
							children: flash.label
						})
					}),
					atEnd && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-bg/90 px-6 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-3xl",
								children: "That's the end"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: primaryBtn,
								onClick: () => {
									if (index === 0) {
										const video = videoRef.current;
										setAtEnd(false);
										if (video) {
											video.currentTime = 0;
											video.play().catch(() => setPlaying(false));
										}
									} else onIndex(0);
								},
								children: "Play from the start"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: ghostBtn,
								onClick: onClose,
								children: "Close"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "safe-bottom mx-auto w-full max-w-lg shrink-0 px-4 pt-1",
				children: [
					showHint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mb-1 w-full text-left text-sm text-muted",
						onClick: onDismissHint,
						children: "Tap the sides to skip 10 seconds. Hold to keep going. Tap here to hide."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 tabular-nums text-sm text-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-12",
								children: formatTime(time)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "scrub",
								type: "range",
								min: 0,
								max: length || 0,
								step: .1,
								value: Math.min(time, length || 0),
								"aria-label": "Position in the video",
								onChange: (event) => {
									const next = Number(event.target.value);
									const video = videoRef.current;
									if (video) video.currentTime = next;
									setTime(next);
									setAtEnd(false);
								}
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-12 text-right",
								children: formatTime(length)
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 grid grid-cols-5 gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: ghostBtn,
								onClick: () => go(index - 1),
								disabled: index === 0,
								"aria-label": "Previous video",
								children: "Prev"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeekButton, {
								label: "−10",
								delta: -10,
								onSeek: seekBy,
								testId: "seek-back"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: primaryBtn,
								onClick: toggle,
								"aria-label": playing ? "Pause" : "Play",
								children: playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-5 fill-current" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-5 fill-current" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeekButton, {
								label: "+10",
								delta: JUMP,
								onSeek: seekBy,
								testId: "seek-forward"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: ghostBtn,
								onClick: () => go(index + 1),
								disabled: index >= queue.length - 1 && !loopAll,
								"aria-label": "Next video",
								children: "Next"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 grid grid-cols-5 gap-2 pb-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeekButton, {
								label: "−5",
								delta: -5,
								onSeek: seekBy
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeekButton, {
								label: "+5",
								delta: 5,
								onSeek: seekBy
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeekButton, {
								label: "+30",
								delta: 30,
								onSeek: seekBy
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: ghostBtn,
								onClick: () => setRate((value) => value === 1 ? 1.25 : value === 1.25 ? 1.5 : value === 1.5 ? 2 : 1),
								"aria-label": "Playback speed",
								children: rate === 1 ? "1×" : `${rate}×`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: ghostBtn,
								onClick: () => setQueueOpen(true),
								"aria-label": "Show queue",
								children: "Queue"
							})
						]
					})
				]
			}),
			queueOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-end justify-center bg-bg/70",
				onClick: () => setQueueOpen(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "dialog",
					"aria-label": "Queue",
					className: "queue-panel safe-bottom w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface px-4 pt-4",
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-3 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-2xl",
								children: "Queue"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: iconBtn$1,
								onClick: () => setQueueOpen(false),
								"aria-label": "Close queue",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "switch",
							"aria-checked": loopAll,
							className: "mb-3 flex h-12 w-full items-center justify-between rounded-2xl bg-surface-2 px-4",
							onClick: () => setLoopAll((value) => !value),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Repeat the queue" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `grid h-7 w-12 place-items-center rounded-full ${loopAll ? "bg-accent" : "bg-border"}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `size-5 rounded-full bg-fg ${loopAll ? "translate-x-2" : "-translate-x-2"}` })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "flex flex-col gap-2 pb-4",
							children: queue.map((item, itemIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `flex h-14 w-full items-center gap-3 rounded-2xl px-3 text-left ${itemIndex === index ? "bg-accent text-accent-fg" : "bg-surface-2"}`,
								onClick: () => {
									onIndex(itemIndex);
									setQueueOpen(false);
									setAtEnd(false);
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-6 tabular-nums",
										children: itemIndex + 1
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "min-w-0 flex-1 truncate",
										children: item.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm opacity-80",
										children: formatTime(item.duration)
									})
								]
							}) }, item.id))
						})
					]
				})
			})
		]
	});
}
function GestureLayer({ onSeek, onToggle }) {
	const hold = (0, import_react.useRef)(null);
	const repeat = (0, import_react.useRef)(null);
	const start = (0, import_react.useRef)({
		x: 0,
		y: 0,
		zone: "c",
		held: false,
		moved: false
	});
	function clear() {
		if (hold.current) window.clearTimeout(hold.current);
		if (repeat.current) window.clearInterval(repeat.current);
		hold.current = null;
		repeat.current = null;
	}
	function zoneOf(event) {
		const rect = event.currentTarget.getBoundingClientRect();
		const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
		if (x < .3) return "l";
		if (x > .7) return "r";
		return "c";
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "gesture-layer absolute inset-0 z-10",
		onContextMenu: (event) => event.preventDefault(),
		onPointerDown: (event) => {
			const zone = zoneOf(event);
			start.current = {
				x: event.clientX,
				y: event.clientY,
				zone,
				held: false,
				moved: false
			};
			clear();
			if (zone === "c") return;
			const delta = zone === "l" ? -10 : JUMP;
			hold.current = window.setTimeout(() => {
				start.current.held = true;
				onSeek(delta);
				repeat.current = window.setInterval(() => onSeek(delta), 180);
			}, 360);
		},
		onPointerMove: (event) => {
			if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 14) {
				start.current.moved = true;
				clear();
			}
		},
		onPointerUp: (event) => {
			clear();
			if (start.current.held || start.current.moved) return;
			const zone = zoneOf(event);
			if (zone === "c") onToggle();
			else onSeek(zone === "l" ? -10 : JUMP);
		},
		onPointerCancel: clear
	});
}
function SeekButton({ label, delta, onSeek, testId }) {
	const timeoutRef = (0, import_react.useRef)(null);
	const intervalRef = (0, import_react.useRef)(null);
	const held = (0, import_react.useRef)(false);
	const skipClick = (0, import_react.useRef)(false);
	function stop() {
		if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
		if (intervalRef.current) window.clearInterval(intervalRef.current);
		timeoutRef.current = null;
		intervalRef.current = null;
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: ghostBtn,
		"data-testid": testId,
		"aria-label": `Jump ${label} seconds`,
		onPointerDown: () => {
			held.current = false;
			stop();
			timeoutRef.current = window.setTimeout(() => {
				held.current = true;
				onSeek(delta);
				intervalRef.current = window.setInterval(() => onSeek(delta), 180);
			}, 320);
		},
		onPointerUp: () => {
			stop();
			skipClick.current = true;
			if (!held.current) onSeek(delta);
		},
		onPointerLeave: stop,
		onPointerCancel: stop,
		onClick: () => {
			if (skipClick.current) {
				skipClick.current = false;
				return;
			}
			onSeek(delta);
		},
		children: label
	});
}
var iconBtn$1 = "grid size-12 place-items-center rounded-full text-fg";
var primaryBtn = "inline-flex h-14 w-full items-center justify-center rounded-2xl bg-accent px-3 font-medium text-accent-fg disabled:opacity-40";
var ghostBtn = "inline-flex h-14 w-full items-center justify-center rounded-2xl bg-surface-2 px-1 text-sm font-medium text-fg disabled:opacity-40";
function Nightbox() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShelfApp, {}) });
}
function ShelfApp() {
	const lib = useLibrary();
	const fileRef = (0, import_react.useRef)(null);
	const [query, setQuery] = (0, import_react.useState)("");
	const [categoryId, setCategoryId] = (0, import_react.useState)("all");
	const [screen, setScreen] = (0, import_react.useState)({ kind: "library" });
	const [selecting, setSelecting] = (0, import_react.useState)(false);
	const [selected, setSelected] = (0, import_react.useState)([]);
	const [player, setPlayer] = (0, import_react.useState)(null);
	const [sheet, setSheet] = (0, import_react.useState)(null);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const byId = (0, import_react.useMemo)(() => new Map(lib.clips.map((clip) => [clip.id, clip])), [lib.clips]);
	const shown = (0, import_react.useMemo)(() => visibleClips(lib.clips, {
		query,
		categoryId,
		prefs: lib.prefs
	}), [
		lib.clips,
		query,
		categoryId,
		lib.prefs
	]);
	const sections = (0, import_react.useMemo)(() => groupClips(shown, lib.categories, lib.prefs.group && categoryId === "all"), [
		shown,
		lib.categories,
		lib.prefs.group,
		categoryId
	]);
	const flat = (0, import_react.useMemo)(() => sections.flatMap((section) => section.clips), [sections]);
	const categoryName = (0, import_react.useMemo)(() => {
		const map = new Map(lib.categories.map((category) => [category.id, category.name]));
		return (id) => id ? map.get(id) ?? "Category" : "No category";
	}, [lib.categories]);
	const liveQueue = player?.ids.map((id) => byId.get(id)).filter((clip) => Boolean(clip)) ?? [];
	const playerIndex = player ? Math.min(player.index, Math.max(liveQueue.length - 1, 0)) : 0;
	(0, import_react.useEffect)(() => {
		if (screen.kind === "playlist" && !lib.playlists.some((playlist) => playlist.id === screen.id)) setScreen({ kind: "playlists" });
	}, [screen, lib.playlists]);
	function openImport() {
		fileRef.current?.click();
	}
	function exitSelect() {
		setSelecting(false);
		setSelected([]);
	}
	function toggleSelected(id) {
		setSelected((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
	}
	function playIds(ids, index, label) {
		const existing = ids.filter((id) => byId.has(id));
		if (!existing.length) return;
		const startId = ids[index];
		const start = startId ? existing.indexOf(startId) : 0;
		setPlayer({
			ids: existing,
			index: Math.max(0, start),
			label
		});
		exitSelect();
	}
	const openPlaylist = lib.playlists.find((playlist) => screen.kind === "playlist" && playlist.id === screen.id);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		onDragOver: (event) => {
			event.preventDefault();
			setDragging(true);
		},
		onDragLeave: () => setDragging(false),
		onDrop: (event) => {
			event.preventDefault();
			setDragging(false);
			lib.importFiles([...event.dataTransfer.files]);
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex min-h-dvh max-w-6xl",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border px-4 py-5 lg:flex",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brand, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `${btn("primary")} mt-5 w-full`,
							onClick: openImport,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-5" }), "Import"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
							className: "mt-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-2 text-sm text-muted",
									children: "Categories"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SideButton, {
									active: screen.kind === "library" && categoryId === "all",
									onClick: () => {
										setScreen({ kind: "library" });
										setCategoryId("all");
									},
									children: ["All videos", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "opacity-70",
										children: lib.clips.length
									})]
								}),
								sortedCategories(lib.categories).map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SideButton, {
									active: screen.kind === "library" && categoryId === category.id,
									onClick: () => {
										setScreen({ kind: "library" });
										setCategoryId(category.id);
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: category.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "opacity-70",
										children: lib.clips.filter((clip) => clip.categoryId === category.id).length
									})]
								}, category.id))
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-2 text-sm text-muted",
									children: "Playlists"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SideButton, {
									active: screen.kind === "playlists",
									onClick: () => setScreen({ kind: "playlists" }),
									children: "All playlists"
								}),
								[...lib.playlists].sort((a, b) => b.createdAt - a.createdAt).map((playlist) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SideButton, {
									active: screen.kind === "playlist" && screen.id === playlist.id,
									onClick: () => setScreen({
										kind: "playlist",
										id: playlist.id
									}),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: playlist.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted",
										children: playlist.clipIds.length
									})]
								}, playlist.id))
							] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "pt-3 text-sm text-muted",
							children: [formatBytes(lib.libraryBytes), " on this device"]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
					className: "min-w-0 flex-1 pb-28",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "safe-top sticky top-0 z-20 bg-bg px-4 pt-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-0.5 bg-accent" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-3 flex items-end justify-between gap-3 lg:hidden",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Brand, {})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-sm text-muted lg:mt-0",
									children: [
										lib.clips.length === 1 ? "1 video" : `${lib.clips.length} videos`,
										" · ",
										formatBytes(lib.libraryBytes),
										" on this device"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative mt-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: query,
											onChange: (event) => setQuery(event.target.value),
											placeholder: "Search your videos",
											className: "h-12 w-full rounded-2xl border border-border bg-surface pr-12 pl-11 text-base text-fg outline-none placeholder:text-muted",
											"aria-label": "Search your videos"
										}),
										query && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center",
											onClick: () => setQuery(""),
											"aria-label": "Clear search",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex gap-2 overflow-x-auto pb-3 no-scrollbar",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolbarButton, {
											onClick: () => selecting ? exitSelect() : setSelecting(true),
											children: selecting ? "Cancel" : "Select"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolbarButton, {
											onClick: () => setSheet({ kind: "sort" }),
											children: sortLabel(lib.prefs)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: iconBtn,
											"aria-label": lib.prefs.layout === "grid" ? "Show as a list" : "Show as a grid",
											onClick: () => void lib.updatePrefs({ layout: lib.prefs.layout === "grid" ? "list" : "grid" }),
											children: lib.prefs.layout === "grid" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutGrid, { className: "size-5" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: iconBtn,
											"aria-label": "Settings",
											onClick: () => setSheet({ kind: "settings" }),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "size-5" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "ml-auto hidden gap-2 lg:flex",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												className: btn("primary"),
												onClick: openImport,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-5" }), "Import"]
											})
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-3 flex h-12 rounded-2xl bg-surface p-1 lg:hidden",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segment, {
										active: screen.kind === "library",
										onClick: () => setScreen({ kind: "library" }),
										children: "Library"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segment, {
										active: screen.kind !== "library",
										onClick: () => setScreen(screen.kind === "playlist" ? screen : { kind: "playlists" }),
										children: "Playlists"
									})]
								})
							]
						}),
						lib.note && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-4 pb-2 text-sm text-muted",
							role: "status",
							children: lib.note
						}),
						lib.busy && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-4 pb-3 text-sm text-accent",
							role: "status",
							children: lib.busy
						}),
						screen.kind === "library" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2 overflow-x-auto px-4 pb-4 no-scrollbar lg:hidden",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									active: categoryId === "all",
									onClick: () => setCategoryId("all"),
									children: "All"
								}),
								sortedCategories(lib.categories).map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									active: categoryId === category.id,
									onClick: () => setCategoryId(category.id),
									children: category.name
								}, category.id)),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
									active: false,
									onClick: () => setSheet({ kind: "settings" }),
									children: "Edit"
								})
							]
						}), !lib.ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-4 text-muted",
							children: "Opening your shelf…"
						}) : lib.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-4 text-muted",
							children: lib.error
						}) : lib.clips.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyShelf, {
							onImport: openImport,
							onSamples: () => void lib.addSamples(),
							busy: Boolean(lib.busy)
						}) : flat.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "px-4 text-muted",
							children: "Nothing matches."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-col gap-6 px-4",
							children: sections.map((section) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [section.name && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mb-3 font-display text-2xl",
								children: section.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: lib.prefs.layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2",
								children: section.clips.map((clip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipCard, {
									clip,
									layout: lib.prefs.layout,
									cover: lib.prefs.covers ? lib.posterUrl(clip.id) : void 0,
									category: categoryName(clip.categoryId),
									order: selecting ? selected.indexOf(clip.id) + 1 : 0,
									onOpen: () => {
										if (selecting) toggleSelected(clip.id);
										else playIds(flat.map((item) => item.id), flat.findIndex((item) => item.id === clip.id), "This list");
									},
									onLong: () => {
										if (!selecting) {
											setSelecting(true);
											setSelected([clip.id]);
										} else toggleSelected(clip.id);
									},
									onMore: () => setSheet({
										kind: "clip",
										id: clip.id
									})
								}, clip.id))
							})] }, section.key))
						})] }),
						screen.kind === "playlists" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaylistIndex, {
							playlists: lib.playlists,
							onOpen: (id) => setScreen({
								kind: "playlist",
								id
							}),
							onCreate: () => setSheet({ kind: "new-playlist" })
						}),
						screen.kind === "playlist" && openPlaylist && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlaylistDetail, {
							playlist: openPlaylist,
							byId,
							posterUrl: lib.posterUrl,
							covers: lib.prefs.covers,
							onBack: () => setScreen({ kind: "playlists" }),
							onPlay: (index) => playIds(openPlaylist.clipIds, index, openPlaylist.name),
							onRename: () => setSheet({
								kind: "rename-playlist",
								id: openPlaylist.id
							}),
							onDelete: () => setSheet({
								kind: "delete-playlist",
								id: openPlaylist.id
							}),
							onRemove: (clipId) => void lib.removeFromPlaylist(openPlaylist.id, clipId),
							onMove: (clipId, dir) => void lib.moveInPlaylist(openPlaylist.id, clipId, dir)
						})
					]
				})]
			}),
			selecting && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-lg items-center justify-between pb-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [selected.length, " selected · numbered in pick order"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-11 rounded-full px-3 text-sm",
							onClick: () => setSelected(flat.map((clip) => clip.id)),
							children: "All"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "h-11 rounded-full px-3 text-sm",
							onClick: exitSelect,
							children: "Done"
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto grid max-w-lg grid-cols-4 gap-2 pb-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: btn("primary"),
							disabled: !selected.length,
							onClick: () => playIds(selected, 0, "Your selection"),
							children: "Play"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: btn("ghost"),
							disabled: !selected.length,
							onClick: () => setSheet({
								kind: "categorize",
								ids: selected
							}),
							children: "Category"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: btn("ghost"),
							disabled: !selected.length,
							onClick: () => setSheet({
								kind: "to-playlist",
								ids: selected
							}),
							children: "Playlist"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: btn("danger"),
							disabled: !selected.length,
							"aria-label": "Remove",
							onClick: () => setSheet({
								kind: "delete",
								ids: selected
							}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
						})
					]
				})]
			}),
			!selecting && !player && screen.kind === "library" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "fixed right-4 bottom-5 z-30 grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-none lg:hidden",
				onClick: openImport,
				"aria-label": "Import videos",
				"data-testid": "import",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-7" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: fileRef,
				type: "file",
				accept: "video/*,.mkv,.mov,.m4v,.avi",
				multiple: true,
				className: "hidden",
				onChange: (event) => {
					const files = [...event.target.files ?? []];
					event.target.value = "";
					if (files.length) lib.importFiles(files);
				}
			}),
			dragging && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none fixed inset-0 z-30 grid place-items-center bg-bg/80",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-3xl",
					children: "Drop videos"
				})
			}),
			sheet && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetFrame, {
				title: sheetTitle(sheet, byId, lib.playlists, lib.categories),
				onClose: () => setSheet(null),
				children: [
					sheet.kind === "sort" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2",
						children: [SORTS.map((item) => {
							const active = lib.prefs.sort === item.sort && lib.prefs.sortDir === item.sortDir;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: choice(active),
								onClick: () => {
									lib.updatePrefs({
										sort: item.sort,
										sortDir: item.sortDir
									});
									setSheet(null);
								},
								children: [item.label, active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-5" })]
							}, item.label);
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: choice(lib.prefs.group),
							onClick: () => void lib.updatePrefs({ group: !lib.prefs.group }),
							children: ["Group by category", lib.prefs.group && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-5" })]
						})]
					}),
					sheet.kind === "settings" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsSheet, { onDeleteCategory: (id) => setSheet({
						kind: "delete-category",
						id
					}) }),
					sheet.kind === "clip" && byId.get(sheet.id) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: choice(false),
								onClick: () => setSheet({
									kind: "rename",
									id: sheet.id
								}),
								children: "Rename"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: choice(false),
								onClick: () => setSheet({
									kind: "categorize",
									ids: [sheet.id]
								}),
								children: "Category"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: choice(false),
								onClick: () => setSheet({
									kind: "to-playlist",
									ids: [sheet.id]
								}),
								children: "Add to playlist"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: btn("danger"),
								onClick: () => setSheet({
									kind: "delete",
									ids: [sheet.id]
								}),
								children: "Remove from Nightbox"
							})
						]
					}),
					sheet.kind === "rename" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NameForm, {
						initial: byId.get(sheet.id)?.name ?? "",
						action: "Save name",
						autoFocus: true,
						onSubmit: (name) => {
							lib.renameClip(sheet.id, name);
							setSheet(null);
						}
					}),
					sheet.kind === "rename-playlist" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NameForm, {
						initial: lib.playlists.find((playlist) => playlist.id === sheet.id)?.name ?? "",
						action: "Save name",
						autoFocus: true,
						onSubmit: (name) => {
							lib.renamePlaylist(sheet.id, name);
							setSheet(null);
						}
					}),
					sheet.kind === "categorize" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: choice(false),
								onClick: () => {
									lib.moveToCategory(sheet.ids, null);
									setSheet(null);
									exitSelect();
								},
								children: "No category"
							}),
							sortedCategories(lib.categories).map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: choice(false),
								onClick: () => {
									lib.moveToCategory(sheet.ids, category.id);
									setSheet(null);
									exitSelect();
								},
								children: category.name
							}, category.id)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NameForm, {
								initial: "",
								action: "Create category",
								placeholder: "New category",
								onSubmit: (name) => {
									lib.createCategory(name).then((id) => {
										if (id) lib.moveToCategory(sheet.ids, id);
									});
									setSheet(null);
									exitSelect();
								}
							})
						]
					}),
					sheet.kind === "to-playlist" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2",
						children: [
							lib.playlists.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: "No playlists yet."
							}),
							[...lib.playlists].sort((a, b) => b.createdAt - a.createdAt).map((playlist) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: choice(false),
								onClick: () => {
									lib.addToPlaylist(playlist.id, sheet.ids);
									setSheet(null);
									exitSelect();
									lib.dismissNote();
									setScreen({
										kind: "playlist",
										id: playlist.id
									});
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate",
									children: playlist.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListVideo, { className: "size-4 text-muted" })]
							}, playlist.id)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NameForm, {
								initial: "",
								action: "Create playlist",
								placeholder: "New playlist",
								onSubmit: (name) => {
									lib.createPlaylist(name, sheet.ids).then((id) => {
										if (id) setScreen({
											kind: "playlist",
											id
										});
									});
									setSheet(null);
									exitSelect();
								}
							})
						]
					}),
					sheet.kind === "new-playlist" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NameForm, {
						initial: "",
						action: "Create playlist",
						placeholder: "Playlist name",
						autoFocus: true,
						onSubmit: (name) => {
							lib.createPlaylist(name).then((id) => {
								if (id) setScreen({
									kind: "playlist",
									id
								});
							});
							setSheet(null);
						}
					}),
					sheet.kind === "delete" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Confirm, {
						body: sheet.ids.length === 1 ? "Removes it from Nightbox only. The original stays in your camera roll." : `Removes ${sheet.ids.length} videos from Nightbox only. Originals stay in your camera roll.`,
						action: "Remove",
						onConfirm: () => {
							lib.removeClips(sheet.ids);
							setSheet(null);
							exitSelect();
						}
					}),
					sheet.kind === "delete-category" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Confirm, {
						body: "Videos in this category stay in the library. They just won't be grouped under this name.",
						action: "Delete category",
						onConfirm: () => {
							lib.removeCategory(sheet.id);
							if (categoryId === sheet.id) setCategoryId("all");
							setSheet(null);
						}
					}),
					sheet.kind === "delete-playlist" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Confirm, {
						body: "The playlist goes away. The videos stay in your library.",
						action: "Delete playlist",
						onConfirm: () => {
							lib.removePlaylist(sheet.id);
							setSheet(null);
							setScreen({ kind: "playlists" });
						}
					})
				]
			}),
			player && liveQueue.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Player, {
				queue: liveQueue,
				index: playerIndex,
				queueLabel: player.label,
				showHint: lib.prefs.showHint,
				onIndex: (index) => setPlayer({
					...player,
					index
				}),
				onClose: () => setPlayer(null),
				onRename: (id) => setSheet({
					kind: "rename",
					id
				}),
				onDismissHint: () => void lib.updatePrefs({ showHint: false }),
				getBlob: lib.getBlob
			})
		]
	});
}
function SettingsSheet({ onDeleteCategory }) {
	const lib = useLibrary();
	const [drafts, setDrafts] = (0, import_react.useState)({});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "switch",
				"aria-checked": lib.prefs.covers,
				className: choice(false),
				onClick: () => void lib.updatePrefs({ covers: !lib.prefs.covers }),
				children: ["Show covers", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-accent",
					children: lib.prefs.covers ? "On" : "Off"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-2 text-sm text-muted",
					children: "Categories"
				}),
				lib.categories.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-2 text-sm text-muted",
					children: "None yet. Create one below."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col gap-2",
					children: sortedCategories(lib.categories).map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: drafts[category.id] ?? category.name,
								onChange: (event) => setDrafts((prev) => ({
									...prev,
									[category.id]: event.target.value
								})),
								className: fieldClass,
								"aria-label": `Rename ${category.name}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: iconBtn,
								"aria-label": `Save ${category.name}`,
								onClick: () => void lib.renameCategory(category.id, drafts[category.id] ?? category.name),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: iconBtn,
								"aria-label": `Delete ${category.name}`,
								onClick: () => onDeleteCategory(category.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
							})
						]
					}, category.id))
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NameForm, {
				initial: "",
				action: "Add category",
				placeholder: "New category",
				onSubmit: (name) => void lib.createCategory(name)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Nightbox keeps copies here so the shelf still works after you leave. Nothing is uploaded. Removing a video does not touch the original file."
			})
		]
	});
}
function PlaylistIndex({ playlists, onOpen, onCreate }) {
	const ordered = [...playlists].sort((a, b) => b.createdAt - a.createdAt);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3 px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: btn("primary"),
			onClick: onCreate,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-5" }), "New playlist"]
		}), ordered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted",
			children: "Playlists are just an order you choose. Select videos, then add them here."
		}) : ordered.map((playlist) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: choice(false),
			onClick: () => onOpen(playlist.id),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "min-w-0 flex-1 truncate text-left",
				children: playlist.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm text-muted",
				children: playlist.clipIds.length
			})]
		}, playlist.id))]
	});
}
function PlaylistDetail({ playlist, byId, posterUrl, covers, onBack, onPlay, onRename, onDelete, onRemove, onMove }) {
	const clips = playlist.clipIds.map((id) => byId.get(id)).filter((clip) => Boolean(clip));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3 px-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: iconBtn,
						onClick: onBack,
						"aria-label": "Back to playlists",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "min-w-0 flex-1 truncate font-display text-3xl",
						children: playlist.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "h-11 rounded-full px-3 text-sm text-accent",
						onClick: onRename,
						children: "Rename"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: btn("primary"),
				disabled: !clips.length,
				onClick: () => onPlay(0),
				children: "Play in this order"
			}),
			clips.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted",
				children: "Nothing in this playlist. Select videos in the library, then choose Playlist."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex flex-col gap-2",
				children: clips.map((clip, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-2 rounded-2xl bg-surface p-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex min-w-0 flex-1 items-center gap-3 text-left",
							onClick: () => onPlay(index),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cover, {
								src: covers ? posterUrl(clip.id) : void 0,
								className: "h-14 w-24"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block truncate font-medium",
									children: clip.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm text-muted",
									children: formatTime(clip.duration)
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: iconBtn,
							"aria-label": "Move earlier",
							disabled: index === 0,
							onClick: () => onMove(clip.id, -1),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: iconBtn,
							"aria-label": "Move later",
							disabled: index === clips.length - 1,
							onClick: () => onMove(clip.id, 1),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: iconBtn,
							"aria-label": "Remove from playlist",
							onClick: () => onRemove(clip.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
						})
					]
				}, clip.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: btn("danger"),
				onClick: onDelete,
				children: "Delete playlist"
			})
		]
	});
}
function ClipCard({ clip, layout, cover, category, order, onOpen, onLong, onMore }) {
	const timer = (0, import_react.useRef)(null);
	const long = (0, import_react.useRef)(false);
	const moved = (0, import_react.useRef)(false);
	const start = (0, import_react.useRef)({
		x: 0,
		y: 0
	});
	function down(event) {
		long.current = false;
		moved.current = false;
		start.current = {
			x: event.clientX,
			y: event.clientY
		};
		if (timer.current) window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			long.current = true;
			onLong();
		}, 420);
	}
	function move(event) {
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `relative ${selected ? "rounded-2xl ring-2 ring-accent" : ""}`,
		"data-testid": "clip-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			role: "button",
			tabIndex: 0,
			className: "w-full text-left select-none",
			onPointerDown: down,
			onPointerMove: move,
			onPointerUp: up,
			onPointerCancel: () => {
				if (timer.current) window.clearTimeout(timer.current);
			},
			onContextMenu: (event) => event.preventDefault(),
			onKeyDown: (event) => {
				if (event.key === "Enter") onOpen();
			},
			children: layout === "grid" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Cover, {
				src: cover,
				className: "aspect-video w-full",
				children: [selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Order, { n: order }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "absolute right-2 bottom-2 rounded-md bg-bg px-1.5 py-0.5 text-xs text-fg tabular-nums",
					children: formatTime(clip.duration)
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-1 pt-2 pr-12 pb-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "truncate font-medium",
					children: clip.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "truncate text-sm text-muted",
					children: category
				})]
			})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3 rounded-2xl bg-surface p-2 pr-14",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cover, {
					src: cover,
					className: "h-16 w-28",
					children: selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Order, { n: order })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block truncate font-medium",
						children: clip.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "block truncate text-sm text-muted",
						children: [
							category,
							" · ",
							formatTime(clip.duration),
							" · ",
							formatBytes(clip.size)
						]
					})]
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "absolute right-1 bottom-1 grid size-11 place-items-center rounded-full text-muted",
			"aria-label": `Actions for ${clip.name}`,
			onPointerDown: (event) => event.stopPropagation(),
			onPointerUp: (event) => event.stopPropagation(),
			onClick: (event) => {
				event.stopPropagation();
				onMore();
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ellipsis, { className: "size-5" })
		})]
	});
}
function Cover({ src, className, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `relative overflow-hidden rounded-xl bg-surface-2 ${className}`,
		children: [src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src,
			alt: "",
			className: "h-full w-full object-cover"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid h-full w-full place-items-center",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Film, { className: "size-6 text-accent" })
		}), children]
	});
}
function Order({ n }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-accent text-sm font-medium text-accent-fg",
		children: n
	});
}
function EmptyShelf({ onImport, onSamples, busy }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-md flex-col items-start gap-4 px-4 pt-6",
		"data-testid": "empty",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid size-20 place-items-center rounded-2xl border border-border bg-surface",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Film, {
					className: "size-9 text-accent",
					strokeWidth: 1.5
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-4xl",
				children: "Nothing here yet"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted",
				children: "Import videos from this phone or tablet. Nightbox keeps them on the device. They are not uploaded."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: btn("primary"),
				onClick: onImport,
				"data-testid": "import-empty",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-5" }), "Import videos"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: btn("ghost"),
				onClick: onSamples,
				disabled: busy,
				children: "Try the player with samples"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "MP4 and MOV from a phone work best. Tap a video to play through the list. Select a few when you want your own order."
			})
		]
	});
}
function Brand() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Film, {
			className: "size-6 text-accent",
			strokeWidth: 1.75
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-3xl italic leading-none",
			children: "Nightbox"
		})]
	});
}
function SheetFrame({ title, onClose, children }) {
	(0, import_react.useEffect)(() => {
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-end justify-center bg-bg/70 sm:items-center",
		onClick: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "dialog",
			"aria-label": title,
			className: "sheet-panel safe-bottom w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-surface px-4 pt-3 sm:rounded-3xl",
			onClick: (event) => event.stopPropagation(),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: iconBtn,
						onClick: onClose,
						"aria-label": "Close",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pb-4",
					children
				})
			]
		})
	});
}
function NameForm({ initial, action, placeholder, autoFocus, onSubmit }) {
	const [name, setName] = (0, import_react.useState)(initial);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "flex flex-col gap-2",
		onSubmit: (event) => {
			event.preventDefault();
			if (name.trim()) onSubmit(name);
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			value: name,
			onChange: (event) => setName(event.target.value),
			placeholder: placeholder ?? "Name",
			maxLength: 80,
			autoFocus,
			className: fieldClass,
			"aria-label": placeholder ?? "Name"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "submit",
			className: btn("primary"),
			disabled: !name.trim(),
			children: action
		})]
	});
}
function Confirm({ body, action, onConfirm }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted",
			children: body
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: btn("danger"),
			onClick: onConfirm,
			children: action
		})]
	});
}
function SideButton({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: `flex h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left ${active ? "bg-accent text-accent-fg" : "text-fg"}`,
		children
	});
}
function Chip({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: `h-11 shrink-0 rounded-full px-4 ${active ? "bg-accent text-accent-fg" : "bg-surface text-fg"}`,
		children
	});
}
function ToolbarButton({ onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: "h-11 shrink-0 rounded-full bg-surface px-4",
		children
	});
}
function Segment({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: `h-full flex-1 rounded-xl font-medium ${active ? "bg-surface-2 text-fg" : "text-muted"}`,
		children
	});
}
function sortedCategories(categories) {
	return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}
function sheetTitle(sheet, byId, playlists, categories) {
	switch (sheet.kind) {
		case "sort": return "Sort";
		case "settings": return "Shelf";
		case "clip": return byId.get(sheet.id)?.name ?? "Video";
		case "rename": return "Rename";
		case "rename-playlist": return "Rename playlist";
		case "categorize": return "Category";
		case "to-playlist": return "Add to playlist";
		case "new-playlist": return "New playlist";
		case "delete": return "Remove";
		case "delete-category": return categories.find((category) => category.id === sheet.id)?.name ?? "Category";
		case "delete-playlist": return playlists.find((playlist) => playlist.id === sheet.id)?.name ?? "Playlist";
	}
}
var btn = (kind) => {
	const base = "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-medium disabled:opacity-40";
	if (kind === "primary") return `${base} bg-accent text-accent-fg`;
	if (kind === "danger") return `${base} border border-danger text-danger`;
	return `${base} bg-surface-2 text-fg`;
};
var iconBtn = "grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-fg disabled:opacity-40";
var fieldClass = "h-12 w-full rounded-2xl border border-border bg-bg px-3 text-base text-fg outline-none placeholder:text-muted";
var choice = (active) => `flex h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left ${active ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg"}`;
var SplitComponent = Nightbox;
//#endregion
export { SplitComponent as component };
