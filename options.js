(() => {
  "use strict";
  const api = globalThis.browser ?? globalThis.chrome;
  const STORAGE_KEY = "authorRules";
  const SETTINGS_KEY = "settings";
  const chooseButton = document.querySelector("#choose-file");
  const importFile = document.querySelector("#import-file");
  const status = document.querySelector("#status");

  function showStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
  }

  chooseButton.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    importFile.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showStatus("Fichier trop volumineux (maximum 1 Mo).", true);
      return;
    }
    try {
      const imported = OpexConfig.validateImport(JSON.parse(await file.text()));
      const count = Object.keys(imported.authorRules).length;
      const current = Object.keys((await api.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {}).length;
      const s = (n) => `${n} auteur${n !== 1 ? "s" : ""}`;
      const question = count === 0
        ? (current
          ? `ATTENTION : cette sauvegarde ne contient AUCUN auteur.\n\nL’importer effacera les ${s(current)} actuellement enregistrés, `
            + `ainsi que ceux de vos autres ordinateurs si la synchronisation est active.\n\nImporter quand même ?`
          : `Cette sauvegarde ne contient aucun auteur (et il n’y en a aucun ici non plus) : seules les couleurs et options seront importées.\n\nContinuer ?`)
        : `Remplacer la configuration actuelle (${s(current)}) par cette sauvegarde (${s(count)}) ?`;
      if (!confirm(question)) {
        showStatus("Import annulé.");
        return;
      }
      await api.storage.local.set({
        [STORAGE_KEY]: imported.authorRules,
        [SETTINGS_KEY]: imported.settings,
        [OpexConfig.PALETTE_KEY]: imported.palette
      });
      showStatus(`Import terminé : ${count} auteur${count !== 1 ? "s" : ""} restauré${count !== 1 ? "s" : ""}.`);
    } catch (error) {
      showStatus(`Échec de l’import : ${error.message}`, true);
    }
  });
})();
