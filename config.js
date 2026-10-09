(() => {
  "use strict";

  function normalizeAuthor(value) {
    return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");
  }

  function validateImport(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Le fichier ne contient pas une configuration valide.");
    }
    if (data.format !== "opex360-commentaires" || data.formatVersion !== 1) {
      throw new Error("Format de sauvegarde non reconnu.");
    }
    if (!data.authorRules || typeof data.authorRules !== "object" || Array.isArray(data.authorRules)) {
      throw new Error("La liste des auteurs est absente ou invalide.");
    }

    const entries = Object.entries(data.authorRules);
    if (entries.length > 5000) throw new Error("La sauvegarde contient trop d’auteurs.");
    const authorRules = {};
    for (const [, rule] of entries) {
      if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        throw new Error("Une règle d’auteur est invalide.");
      }
      if (typeof rule.author !== "string" || !rule.author.trim() || rule.author.length > 200) {
        throw new Error("Un nom d’auteur est invalide.");
      }
      const key = normalizeAuthor(rule.author);
      if (!key || ["__proto__", "prototype", "constructor"].includes(key)) {
        throw new Error("Un nom d’auteur n’est pas autorisé.");
      }
      if (rule.type === "hidden") {
        authorRules[key] = { author: rule.author.trim(), type: "hidden" };
      } else if (rule.type === "color" && /^#[0-9a-f]{6}$/i.test(rule.color || "")) {
        authorRules[key] = { author: rule.author.trim(), type: "color", color: rule.color.toLowerCase() };
      } else {
        throw new Error(`Règle invalide pour ${rule.author}.`);
      }
    }

    const importedSettings = data.settings;
    if (!importedSettings || typeof importedSettings !== "object" || Array.isArray(importedSettings)) {
      throw new Error("Les options de la sauvegarde sont invalides.");
    }
    return {
      authorRules,
      settings: { hideBranches: Boolean(importedSettings.hideBranches) }
    };
  }

  globalThis.OpexConfig = Object.freeze({ validateImport });
})();
