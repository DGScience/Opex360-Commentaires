(() => {
  "use strict";
  const api = globalThis.browser ?? globalThis.chrome;
  const STORAGE_KEY = "authorRules";
  const SETTINGS_KEY = "settings";
  const template = document.querySelector("#rule-template");
  const hideBranches = document.querySelector("#hide-branches");
  const exportButton = document.querySelector("#export-config");
  const importButton = document.querySelector("#import-config");
  const transferStatus = document.querySelector("#transfer-status");

  function showStatus(message, error = false) {
    transferStatus.textContent = message;
    transferStatus.classList.toggle("error", error);
  }

  exportButton.addEventListener("click", async () => {
    try {
      const data = await api.storage.local.get([STORAGE_KEY, SETTINGS_KEY]);
      const backup = {
        format: "opex360-commentaires",
        formatVersion: 1,
        extensionVersion: "2026.5",
        exportedAt: new Date().toISOString(),
        authorRules: data[STORAGE_KEY] || {},
        settings: { hideBranches: Boolean(data[SETTINGS_KEY]?.hideBranches) }
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
      showStatus("Configuration exportée.");
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

  function renderList(container, entries, rules) {
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
      if (rule.type === "color") row.querySelector(".swatch").style.background = rule.color;
      row.querySelector("button").addEventListener("click", async () => {
        delete rules[key];
        await api.storage.local.set({ [STORAGE_KEY]: rules });
        render();
      });
      container.append(row);
    }
  }

  async function render() {
    const data = await api.storage.local.get([STORAGE_KEY, SETTINGS_KEY]);
    const rules = data[STORAGE_KEY] || {};
    hideBranches.checked = Boolean(data[SETTINGS_KEY]?.hideBranches);
    const entries = Object.entries(rules).sort((a, b) =>
      (a[1].author || a[0]).localeCompare(b[1].author || b[0], "fr", { sensitivity: "base" })
    );
    renderList(document.querySelector("#hidden-list"), entries.filter(([, r]) => r.type === "hidden"), rules);
    renderList(document.querySelector("#color-list"), entries.filter(([, r]) => r.type === "color"), rules);
  }

  render();
})();
