(() => {
  "use strict";

  const PALETTE_KEY = "palette";
  const DEFAULT_PALETTE = Object.freeze([
    Object.freeze({ id: "p1", name: "Vert", color: "#dff5e3" }),
    Object.freeze({ id: "p2", name: "Jaune", color: "#fff1b8" }),
    Object.freeze({ id: "p3", name: "Bleu", color: "#dcecff" }),
    Object.freeze({ id: "p4", name: "Violet", color: "#f0e1ff" }),
    Object.freeze({ id: "p5", name: "Rose", color: "#ffe0ea" })
  ]);
  const LABEL_MAX = 40;
  const MAX_SLOTS = 20;
  const ID_RE = /^[a-z0-9]{1,16}$/;
  const NEW_COLORS = ["#dff5e3", "#fff1b8", "#dcecff", "#f0e1ff", "#ffe0ea", "#ffe4c7",
    "#d6f3f1", "#e8e8e8", "#e6f0c8", "#f9d8d8", "#d9dcff", "#f5e6d3"];

  function normalizeAuthor(value) {
    return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");
  }

  /** "#abc", "abc", "#AABBCC", "aabbcc" -> "#aabbcc" ; sinon null. */
  function parseHex(value) {
    if (typeof value !== "string") return null;
    let v = value.trim().replace(/^#/, "").toLowerCase();
    if (/^[0-9a-f]{3}$/.test(v)) v = v.split("").map((c) => c + c).join("");
    return /^[0-9a-f]{6}$/.test(v) ? `#${v}` : null;
  }

  /** Palette stockée -> liste de catégories valides (au moins une ; défaut si absente/vide). */
  function normalizePalette(stored) {
    const out = [];
    for (const s of Array.isArray(stored) ? stored : []) {
      if (!s || typeof s.id !== "string" || !ID_RE.test(s.id) || out.some((e) => e.id === s.id)) continue;
      const def = DEFAULT_PALETTE.find((d) => d.id === s.id);
      const color = parseHex(s.color) || def?.color;
      if (!color) continue;
      const label = typeof s.label === "string" ? s.label.trim().slice(0, LABEL_MAX) : "";
      out.push({ id: s.id, name: def?.name || "", color, label });
      if (out.length >= MAX_SLOTS) break;
    }
    return out.length ? out : DEFAULT_PALETTE.map((d) => ({ ...d, label: "" }));
  }

  /** Nouvelle catégorie : identifiant unique, couleur pas encore utilisée si possible. */
  function newSlot(palette) {
    let id;
    do { id = "c" + Math.random().toString(36).slice(2, 10); } while (palette.some((p) => p.id === id));
    const color = NEW_COLORS.find((c) => !palette.some((p) => p.color === c)) || "#e8e8e8";
    return { id, name: "", color, label: "" };
  }

  /** Nom de la couleur : nom par défaut si inchangée, sinon code web. */
  function colorName(entry) {
    const def = DEFAULT_PALETTE.find((d) => d.id === entry.id);
    return def && def.color === entry.color ? def.name : entry.color.toUpperCase();
  }

  /** Texte affiché dans les listes : label personnalisé + couleur, ou nom de la couleur. */
  function optionText(entry) {
    return entry.label ? `${entry.label} (${colorName(entry)})` : colorName(entry);
  }

  /** Emplacement de palette d'une règle couleur (slot, ou ancienne règle retrouvée par sa couleur). */
  function findSlot(rule, palette) {
    if (!rule || rule.type !== "color") return null;
    const legacy = DEFAULT_PALETTE.find((p) => p.color === rule.color);
    return palette.find((p) => p.id === rule.slot)
      || palette.find((p) => p.color === rule.color)
      || (legacy && palette.find((p) => p.id === legacy.id))
      || null;
  }

  function ruleColor(rule, palette) {
    return findSlot(rule, palette)?.color || parseHex(rule?.color) || DEFAULT_PALETTE[0].color;
  }

  /** Texte noir ou blanc selon la luminance du fond. */
  function textColorFor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.179 ? "#111111" : "#ffffff";
  }

  function validateImport(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Le fichier ne contient pas une configuration valide.");
    }
    if (data.format !== "opex360-commentaires" || ![1, 2].includes(data.formatVersion)) {
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
        const clean = { author: rule.author.trim(), type: "color", color: rule.color.toLowerCase() };
        if (typeof rule.slot === "string" && ID_RE.test(rule.slot)) clean.slot = rule.slot;
        authorRules[key] = clean;
      } else {
        throw new Error(`Règle invalide pour ${rule.author}.`);
      }
    }

    const importedSettings = data.settings;
    if (!importedSettings || typeof importedSettings !== "object" || Array.isArray(importedSettings)) {
      throw new Error("Les options de la sauvegarde sont invalides.");
    }
    if (data.palette !== undefined && !Array.isArray(data.palette)) {
      throw new Error("La palette de la sauvegarde est invalide.");
    }
    return {
      authorRules,
      settings: { hideBranches: Boolean(importedSettings.hideBranches) },
      palette: normalizePalette(data.palette).map(({ id, color, label }) => ({ id, color, label }))
    };
  }

  globalThis.OpexConfig = Object.freeze({
    PALETTE_KEY, DEFAULT_PALETTE, LABEL_MAX, MAX_SLOTS,
    normalizeAuthor, parseHex, normalizePalette, newSlot, colorName, optionText,
    findSlot, ruleColor, textColorFor, validateImport
  });
})();
