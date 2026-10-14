// Synchronisation storage.local <-> storage.sync (compte Firefox).
// storage.local reste le stockage de travail ; ce script le réplique dans storage.sync
// sous forme compacte et découpée (8 Ko max par élément, 100 Ko au total).
(() => {
  "use strict";
  const api = globalThis.browser ?? globalThis.chrome;
  const C = globalThis.OpexConfig;
  const RULES = "authorRules", SETTINGS = "settings", PALETTE = C.PALETTE_KEY;
  const DATA_KEYS = [RULES, SETTINGS, PALETTE];
  const ENABLED = "syncEnabled";     // local, propre à l'appareil (défaut : true)
  const STATE = "syncState";         // local : { rev, dirty }
  const STATUS = "syncStatus";       // local : { ok, message, at } affiché dans le popup
  const META = "o360_meta";          // sync : { rev, chunks }
  const CHUNK = "o360_c";            // sync : o360_c0, o360_c1…
  const CHUNK_CHARS = 2000;          // ≤ 6 Ko en UTF-8 même au pire cas

  let pushTimer = null;
  let queue = Promise.resolve();
  const serial = (fn) => (queue = queue.then(fn, fn).catch((e) => setStatus(false, e.message)));

  async function setStatus(ok, message) {
    await api.storage.local.set({ [STATUS]: { ok, message, at: new Date().toISOString() } });
  }

  async function enabled() {
    return (await api.storage.local.get(ENABLED))[ENABLED] !== false;
  }

  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16) + ":" + text.length;
  }

  // ---- format compact ----
  function pack(data) {
    const palette = C.normalizePalette(data[PALETTE]);
    const r = Object.values(data[RULES] || {}).map((rule) =>
      rule.type === "hidden" ? [rule.author, 0]
        : [rule.author, C.findSlot(rule, palette)?.id || C.parseHex(rule.color) || "#dff5e3"]);
    return JSON.stringify({
      v: 2,
      r,
      h: Boolean(data[SETTINGS]?.hideBranches),
      p: palette.map((e) => [e.id, e.color, e.label])
    });
  }

  function unpack(text) {
    const o = JSON.parse(text);
    if (!o || ![1, 2].includes(o.v) || !Array.isArray(o.r) || !Array.isArray(o.p)) throw new Error("Données synchronisées illisibles.");
    const palette = C.normalizePalette(o.v === 1
      ? C.DEFAULT_PALETTE.map((d, i) => ({ id: d.id, color: o.p[i]?.[0], label: o.p[i]?.[1] }))
      : o.p.map((e) => ({ id: e?.[0], color: e?.[1], label: e?.[2] })));
    const rules = {};
    for (const [author, v] of o.r) {
      if (typeof author !== "string" || !author.trim()) continue;
      const key = C.normalizeAuthor(author);
      if (["__proto__", "prototype", "constructor"].includes(key)) continue;
      if (v === 0) { rules[key] = { author, type: "hidden" }; continue; }
      const slot = palette.find((p) => p.id === v);
      const color = slot?.color || C.parseHex(v);
      if (!color) continue;
      rules[key] = slot ? { author, type: "color", slot: slot.id, color } : { author, type: "color", color };
    }
    return {
      [RULES]: rules,
      [PALETTE]: palette.map(({ id, color, label }) => ({ id, color, label })),
      hideBranches: Boolean(o.h)
    };
  }

  // ---- accès sync ----
  async function readRemote() {
    const meta = (await api.storage.sync.get(META))[META];
    if (!meta || !Number.isInteger(meta.chunks)) return null;
    const keys = Array.from({ length: meta.chunks }, (_, i) => CHUNK + i);
    const got = await api.storage.sync.get(keys);
    const text = keys.map((k) => {
      if (typeof got[k] !== "string") throw new Error("Synchronisation incomplète (en cours sur un autre appareil ?).");
      return got[k];
    }).join("");
    return { rev: meta.rev, data: unpack(text) };
  }

  async function push() {
    if (!(await enabled())) return;
    const data = await api.storage.local.get(DATA_KEYS);
    const text = pack(data);
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_CHARS) chunks.push(text.slice(i, i + CHUNK_CHARS));
    const rev = Date.now();
    const old = (await api.storage.sync.get(META))[META];
    const items = {};
    chunks.forEach((c, i) => { items[CHUNK + i] = c; });
    try {
      await api.storage.sync.set(items);
      await api.storage.sync.set({ [META]: { rev, chunks: chunks.length } });
    } catch (e) {
      throw new Error(`Envoi impossible : ${e.message} (trop d’auteurs pour le quota de 100 Ko ?)`);
    }
    if (old?.chunks > chunks.length) {
      await api.storage.sync.remove(Array.from({ length: old.chunks - chunks.length }, (_, i) => CHUNK + (chunks.length + i)));
    }
    await api.storage.local.set({ [STATE]: { rev, dirty: false, hash: hash(text) } });
    const n = Object.keys(data[RULES] || {}).length;
    await setStatus(true, `Envoyé (${n} auteur${n !== 1 ? "s" : ""}).`);
  }

  async function writeLocal(remoteData, rev) {
    const current = await api.storage.local.get(SETTINGS);
    const next = {
      [RULES]: remoteData[RULES],
      [PALETTE]: remoteData[PALETTE],
      [SETTINGS]: { ...(current[SETTINGS] || {}), hideBranches: remoteData.hideBranches }
    };
    // L'empreinte permet d'ignorer l'événement onChanged provoqué par cette écriture.
    await api.storage.local.set({ ...next, [STATE]: { rev, dirty: false, hash: hash(pack(next)) } });
  }

  async function pull(remote) {
    await writeLocal(remote.data, remote.rev);
    const n = Object.keys(remote.data[RULES]).length;
    await setStatus(true, `Reçu (${n} auteur${n !== 1 ? "s" : ""}).`);
  }

  /** Fusion : union des auteurs ; en cas de conflit, la règle locale l'emporte. */
  async function mergeThenPush(remote) {
    const local = await api.storage.local.get(DATA_KEYS);
    const rules = { ...remote.data[RULES], ...(local[RULES] || {}) };
    const localPaletteSet = Array.isArray(local[PALETTE]);
    await writeLocal({
      [RULES]: rules,
      [PALETTE]: localPaletteSet ? local[PALETTE] : remote.data[PALETTE],
      hideBranches: local[SETTINGS] ? Boolean(local[SETTINGS].hideBranches) : remote.data.hideBranches
    }, remote.rev);
    await push();
  }

  async function reconcile() {
    if (!(await enabled())) {
      await setStatus(true, "Désactivée sur cet appareil.");
      return;
    }
    const state = (await api.storage.local.get(STATE))[STATE];
    const remote = await readRemote();
    if (!remote) return push();                          // rien en ligne : on publie
    if (!state || state.rev === undefined) return mergeThenPush(remote); // 1re synchro de cet appareil
    if (remote.rev > state.rev) return state.dirty ? mergeThenPush(remote) : pull(remote);
    if (state.dirty) return push();
    await setStatus(true, "À jour.");
  }

  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes[ENABLED]) { serial(reconcile); return; }
      if (!DATA_KEYS.some((k) => changes[k])) return;
      serial(async () => {
        const state = (await api.storage.local.get(STATE))[STATE] || {};
        const current = hash(pack(await api.storage.local.get(DATA_KEYS)));
        if (current === state.hash) return;              // écriture venue de la synchro
        await api.storage.local.set({ [STATE]: { ...state, dirty: true } });
        clearTimeout(pushTimer);
        pushTimer = setTimeout(() => serial(push), 1500);
      });
    } else if (area === "sync" && changes[META]) {
      serial(async () => {
        if (!(await enabled())) return;
        const state = (await api.storage.local.get(STATE))[STATE] || {};
        const rev = changes[META].newValue?.rev;
        if (rev && rev !== state.rev) await reconcile();
      });
    }
  });

  api.runtime.onStartup.addListener(() => serial(reconcile));
  api.runtime.onInstalled.addListener(() => serial(reconcile));
  api.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "o360-sync-now") return serial(reconcile);
    return undefined;
  });
})();
