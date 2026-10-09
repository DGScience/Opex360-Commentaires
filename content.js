(() => {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const STORAGE_KEY = "authorRules";
  const SETTINGS_KEY = "settings";
  const COMMENT_SELECTORS = ["li.comment", ".comment", "article[id^='comment-']"];
  const AUTHOR_SELECTORS = [
    ".comment-author .fn",
    ".comment-author cite",
    ".comment-author",
    ".fn",
    "[itemprop='author']"
  ];
  const BODY_SELECTORS = [".comment-body", "article.comment-body", ".comment-container"];
  const PALETTE = [
    ["#dff5e3", "Vert"],
    ["#fff1b8", "Jaune"],
    ["#dcecff", "Bleu"],
    ["#f0e1ff", "Violet"],
    ["#ffe0ea", "Rose"]
  ];

  let rules = {};
  let settings = { hideBranches: false };

  const normalize = (value) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");

  function directCommentBody(comment) {
    for (const selector of BODY_SELECTORS) {
      const candidates = comment.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (candidate.closest(COMMENT_SELECTORS.join(",")) === comment) return candidate;
      }
    }
    return comment;
  }

  function findAuthor(comment) {
    for (const selector of AUTHOR_SELECTORS) {
      const candidates = comment.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (candidate.closest(COMMENT_SELECTORS.join(",")) !== comment) continue;
        const name = candidate.textContent.replace(/\s+dit\s*:\s*$/i, "").trim();
        if (name) return name;
      }
    }
    return "";
  }

  async function setRule(author, rule) {
    const key = normalize(author);
    if (rule) rules[key] = { author, ...rule };
    else delete rules[key];
    await api.storage.local.set({ [STORAGE_KEY]: rules });
    applyAll();
  }

  function makeToolbar(comment, body, author) {
    let toolbar = body.querySelector(":scope > .o360-toolbar");
    if (toolbar) return toolbar;

    toolbar = document.createElement("div");
    toolbar.className = "o360-toolbar";
    toolbar.dataset.opex360Ui = "true";

    const hide = document.createElement("button");
    hide.type = "button";
    hide.className = "o360-action o360-hide-author";
    hide.textContent = "Masquer cet auteur";
    hide.title = `Masquer tous les commentaires de ${author}`;
    hide.addEventListener("click", () => {
      const current = rules[normalize(author)];
      setRule(author, current?.type === "hidden" ? null : { type: "hidden" });
    });

    const label = document.createElement("label");
    label.className = "o360-color-label";
    label.textContent = "Auteur apprécié : ";
    const select = document.createElement("select");
    select.className = "o360-color-select";
    select.title = `Choisir une couleur pour ${author}`;
    select.append(new Option("Aucune couleur", ""));
    for (const [value, name] of PALETTE) select.append(new Option(name, value));
    select.addEventListener("change", () => {
      setRule(author, select.value ? { type: "color", color: select.value } : null);
    });
    label.append(select);
    toolbar.append(hide, label);
    body.append(toolbar);
    return toolbar;
  }

  function makePlaceholder(comment, body, toolbar, author) {
    let placeholder = comment.querySelector(":scope > .o360-placeholder");
    if (placeholder) return placeholder;
    placeholder = document.createElement("div");
    placeholder.className = "o360-placeholder";
    placeholder.dataset.opex360Ui = "true";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "o360-node-toggle";
    toggle.textContent = "+";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", `Afficher le commentaire de ${author}`);

    const text = document.createElement("span");
    text.className = "o360-node-label";
    text.textContent = `Commentaire de ${author} masqué`;

    toggle.addEventListener("click", () => {
      const expand = comment.dataset.o360Expanded !== "true";
      comment.dataset.o360Expanded = expand ? "true" : "false";
      comment.classList.toggle("o360-collapsed-branch", settings.hideBranches && !expand);
      body.classList.toggle("o360-hidden-body", !settings.hideBranches && !expand);
      toolbar.hidden = !expand;
      toggle.textContent = expand ? "−" : "+";
      toggle.setAttribute("aria-expanded", String(expand));
      toggle.setAttribute("aria-label", `${expand ? "Replier" : "Afficher"} le commentaire de ${author}`);
      text.textContent = expand
        ? `Commentaire de ${author}`
        : settings.hideBranches
          ? `Branche de ${author} masquée`
          : `Commentaire de ${author} masqué`;
    });

    placeholder.append(toggle, text);
    body.before(placeholder);
    return placeholder;
  }

  function resetComment(comment, body) {
    comment.classList.remove("o360-collapsed-branch");
    body.classList.remove("o360-hidden-body", "o360-highlighted");
    body.style.removeProperty("--o360-color");
    const placeholder = comment.querySelector(":scope > .o360-placeholder");
    if (placeholder) placeholder.hidden = true;
    const toolbar = body.querySelector(":scope > .o360-toolbar");
    if (toolbar) {
      toolbar.hidden = false;
      toolbar.querySelector(".o360-color-select").value = "";
      const hide = toolbar.querySelector(".o360-hide-author");
      hide.textContent = "Masquer cet auteur";
      hide.title = "Masquer tous les commentaires de cet auteur";
    }
  }

  function applyComment(comment) {
    if (!(comment instanceof HTMLElement)) return;
    const author = findAuthor(comment);
    if (!author) return;
    const body = directCommentBody(comment);
    resetComment(comment, body);
    const toolbar = makeToolbar(comment, body, author);
    const rule = rules[normalize(author)];

    if (rule?.type === "hidden") {
      const expanded = comment.dataset.o360Expanded === "true";
      comment.classList.toggle("o360-collapsed-branch", settings.hideBranches && !expanded);
      body.classList.toggle("o360-hidden-body", !settings.hideBranches && !expanded);
      toolbar.hidden = !expanded;
      const hide = toolbar.querySelector(".o360-hide-author");
      hide.textContent = "Ne plus masquer cet auteur";
      hide.title = `Réafficher normalement les commentaires de ${author}`;
      const placeholder = makePlaceholder(comment, body, toolbar, author);
      placeholder.hidden = false;
      const toggle = placeholder.querySelector(".o360-node-toggle");
      toggle.textContent = expanded ? "−" : "+";
      toggle.setAttribute("aria-expanded", String(expanded));
      placeholder.querySelector(".o360-node-label").textContent = expanded
        ? `Commentaire de ${author}`
        : settings.hideBranches
          ? `Branche de ${author} masquée`
          : `Commentaire de ${author} masqué`;
    } else if (rule?.type === "color") {
      delete comment.dataset.o360Expanded;
      body.classList.add("o360-highlighted");
      body.style.setProperty("--o360-color", rule.color || PALETTE[0][0]);
      toolbar.querySelector(".o360-color-select").value = rule.color || PALETTE[0][0];
    } else {
      delete comment.dataset.o360Expanded;
    }
  }

  function getComments() {
    const found = new Set();
    for (const selector of COMMENT_SELECTORS) {
      document.querySelectorAll(selector).forEach((node) => {
        // Évite de traiter .comment-body comme un commentaire complet.
        if (!node.classList.contains("comment-body")) found.add(node);
      });
    }
    return found;
  }

  function applyAll() {
    getComments().forEach(applyComment);
  }

  api.storage.local.get([STORAGE_KEY, SETTINGS_KEY]).then((data) => {
    rules = data[STORAGE_KEY] || {};
    settings = { ...settings, ...(data[SETTINGS_KEY] || {}) };
    applyAll();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => [...m.addedNodes].some((n) => n.nodeType === Node.ELEMENT_NODE && !n.dataset?.opex360Ui))) {
        applyAll();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let changed = false;
    if (changes[STORAGE_KEY]) {
      rules = changes[STORAGE_KEY].newValue || {};
      changed = true;
    }
    if (changes[SETTINGS_KEY]) {
      settings = { hideBranches: false, ...(changes[SETTINGS_KEY].newValue || {}) };
      changed = true;
    }
    if (changed) {
      applyAll();
    }
  });
})();
