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
      if (!confirm(`Remplacer la configuration actuelle par cette sauvegarde (${count} auteur${count !== 1 ? "s" : ""}) ?`)) {
        showStatus("Import annulé.");
        return;
      }
      await api.storage.local.set({
        [STORAGE_KEY]: imported.authorRules,
        [SETTINGS_KEY]: imported.settings
      });
      showStatus(`Import terminé : ${count} auteur${count !== 1 ? "s" : ""} restauré${count !== 1 ? "s" : ""}.`);
    } catch (error) {
      showStatus(`Échec de l’import : ${error.message}`, true);
    }
  });
})();
