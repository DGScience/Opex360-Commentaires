(() => {
  "use strict";
  const api = globalThis.browser ?? globalThis.chrome;
  const STORAGE_KEY = "authorRules";
  const SETTINGS_KEY = "settings";
  const C = globalThis.OpexConfig;
  const PALETTE_KEY = C.PALETTE_KEY;
  const paletteTemplate = document.querySelector("#palette-template");
  const paletteList = document.querySelector("#palette-list");
  const addSlot = document.querySelector("#add-slot");
  let currentPalette = [];

  addSlot.addEventListener("click", async () => {
    if (currentPalette.length >= C.MAX_SLOTS) return;
    currentPalette.push(C.newSlot(currentPalette));
    await savePalette(currentPalette);
    renderPalette(currentPalette);
    renderRules();
    paletteList.lastElementChild?.querySelector(".slot-label").focus();
  });
  const template = document.querySelector("#rule-template");
  const hideBranches = document.querySelector("#hide-branches");
  const exportButton = document.querySelector("#export-config");
  const importButton = document.querySelector("#import-config");
  const transferStatus = document.querySelector("#transfer-status");
  const syncEnabled = document.querySelector("#sync-enabled");
  const syncStatus = document.querySelector("#sync-status");

  function showSync(st) {
    syncStatus.textContent = st ? `${st.message} ${new Date(st.at).toLocaleString("fr-FR")}` : "";
    syncStatus.classList.toggle("error", st ? !st.ok : false);
  }
  syncEnabled.addEventListener("change", () => api.storage.local.set({ syncEnabled: syncEnabled.checked }));
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.syncStatus) showSync(changes.syncStatus.newValue);
  });
  api.storage.local.get(["syncEnabled", "syncStatus"]).then((d) => {
    syncEnabled.checked = d.syncEnabled !== false;
    showSync(d.syncStatus);
  });
  api.runtime.sendMessage({ type: "o360-sync-now" }).catch(() => {});

  function showStatus(message, error = false) {
    transferStatus.textContent = message;
    transferStatus.classList.toggle("error", error);
  }

  exportButton.addEventListener("click", async () => {
    try {
      const data = await api.storage.local.get([STORAGE_KEY, SETTINGS_KEY, PALETTE_KEY]);
      const backup = {
        format: "opex360-commentaires",
        formatVersion: 2,
        extensionVersion: api.runtime.getManifest().version,
        exportedAt: new Date().toISOString(),
        authorRules: data[STORAGE_KEY] || {},
        settings: { hideBranches: Boolean(data[SETTINGS_KEY]?.hideBranches) },
        palette: C.normalizePalette(data[PALETTE_KEY]).map(({ id, color, label }) => ({ id, color, label }))
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `opex360-commentaires-configuration-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const n = Object.keys(backup.authorRules).length;
      showStatus(n ? `Configuration exportée (${n} auteur${n !== 1 ? "s" : ""}).`
        : "Attention : configuration exportée, mais elle ne contient aucun auteur.", !n);
    } catch (error) {
      showStatus(`Échec de l’export : ${error.message}`, true);
    }
  });

  importButton.addEventListener("click", async () => {
    await api.runtime.openOptionsPage();
    window.close();
  });

  hideBranches.addEventListener("change", async () => {
    const data = await api.storage.local.get(SETTINGS_KEY);
    await api.storage.local.set({
      [SETTINGS_KEY]: { ...(data[SETTINGS_KEY] || {}), hideBranches: hideBranches.checked }
    });
  });

  async function savePalette(palette) {
    await api.storage.local.set({
      [PALETTE_KEY]: palette.map(({ id, color, label }) => ({ id, color, label }))
    });
  }

  function renderPalette(palette) {
    currentPalette = palette;
    paletteList.replaceChildren();
    addSlot.disabled = palette.length >= C.MAX_SLOTS;
    addSlot.title = addSlot.disabled ? `Maximum ${C.MAX_SLOTS} catégories` : "";
    for (const entry of palette) {
      const def = C.DEFAULT_PALETTE.find((d) => d.id === entry.id);
      const row = paletteTemplate.content.firstElementChild.cloneNode(true);
      const swatch = row.querySelector(".swatch");
      const label = row.querySelector(".slot-label");
      const hex = row.querySelector(".slot-hex");
      swatch.style.background = entry.color;
      label.value = entry.label;
      label.placeholder = C.colorName(entry);
      hex.value = entry.color;
      hex.placeholder = def ? def.color : "#rrggbb";
      const reset = row.querySelector(".slot-reset");
      reset.hidden = !def;
      const del = row.querySelector(".slot-delete");
      del.disabled = palette.length <= 1;
      del.title = del.disabled ? "Il faut garder au moins une catégorie" : "Supprimer cette catégorie";
      del.addEventListener("click", async () => {
        if (palette.length <= 1) return;
        const data = await api.storage.local.get(STORAGE_KEY);
        const rules = data[STORAGE_KEY] || {};
        const users = Object.entries(rules).filter(([, r]) => C.findSlot(r, palette)?.id === entry.id);
        if (users.length) {
          const names = users.slice(0, 8).map(([, r]) => r.author).join(", ") + (users.length > 8 ? "…" : "");
          if (!confirm(`Supprimer « ${C.optionText(entry)} » ?\n\n${users.length === 1 ? "1 auteur perdra sa couleur" : `${users.length} auteurs perdront leur couleur`} : ${names}`)) return;
          users.forEach(([key]) => delete rules[key]);
        }
        palette.splice(palette.indexOf(entry), 1);
        await api.storage.local.set({
          [STORAGE_KEY]: rules,
          [PALETTE_KEY]: palette.map(({ id, color, label }) => ({ id, color, label }))
        });
        renderPalette(palette);
        renderRules();
      });

      label.addEventListener("input", async () => {
        entry.label = label.value.trim().slice(0, C.LABEL_MAX);
        await savePalette(palette);
        renderRules();
      });
      hex.addEventListener("input", async () => {
        const parsed = C.parseHex(hex.value);
        hex.classList.toggle("invalid", !parsed);
        if (!parsed) return;
        swatch.style.background = parsed;
        entry.color = parsed;
        label.placeholder = C.colorName(entry);
        await savePalette(palette);
        renderRules();
      });
      hex.addEventListener("change", () => {
        if (C.parseHex(hex.value)) hex.value = entry.color;
      });
      reset.addEventListener("click", async () => {
        if (!def) return;
        entry.color = def.color;
        entry.label = "";
        await savePalette(palette);
        renderPalette(palette);
        renderRules();
      });
      paletteList.append(row);
    }
  }

  function renderList(container, entries, rules, palette) {
    container.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Aucun auteur.";
      container.append(empty);
      return;
    }
    for (const [key, rule] of entries) {
      const row = template.content.firstElementChild.cloneNode(true);
      row.querySelector(".author").textContent = rule.author || key;
      if (rule.type === "color") {
        row.querySelector(".swatch").style.background = C.ruleColor(rule, palette);
        const slot = C.findSlot(rule, palette);
        row.querySelector(".slot-name").textContent = slot ? C.optionText(slot) : "";
      }
      row.querySelector("button").addEventListener("click", async () => {
        delete rules[key];
        await api.storage.local.set({ [STORAGE_KEY]: rules });
        renderRules();
      });
      container.append(row);
    }
  }

  async function render() {
    const data = await api.storage.local.get([SETTINGS_KEY, PALETTE_KEY]);
    hideBranches.checked = Boolean(data[SETTINGS_KEY]?.hideBranches);
    renderPalette(C.normalizePalette(data[PALETTE_KEY]));
    await renderRules();
  }

  async function renderRules() {
    const data = await api.storage.local.get([STORAGE_KEY, PALETTE_KEY]);
    const rules = data[STORAGE_KEY] || {};
    const palette = C.normalizePalette(data[PALETTE_KEY]);
    const entries = Object.entries(rules).sort((a, b) =>
      (a[1].author || a[0]).localeCompare(b[1].author || b[0], "fr", { sensitivity: "base" })
    );
    renderList(document.querySelector("#hidden-list"), entries.filter(([, r]) => r.type === "hidden"), rules, palette);
    renderList(document.querySelector("#color-list"), entries.filter(([, r]) => r.type === "color"), rules, palette);
  }

  render();
})();
