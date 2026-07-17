(function () {
  const root = document.querySelector("[data-resource-filters]");
  const list = document.querySelector("[data-resource-list]");

  if (!root || !list) {
    return;
  }

  const cards = Array.from(list.querySelectorAll("[data-resource-card]"));
  const searchInput = root.querySelector("[data-resource-filter-search]");
  const sortSelect = root.querySelector("[data-resource-sort]");
  const summary = document.querySelector("[data-resource-filter-summary]");
  const emptyState = document.querySelector("[data-resource-filter-empty]");
  const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
  const publicFilterAliases = {
    "scolaires / etudiants": [
      "scolaires / etudiants",
      "scolaires",
      "etudiants",
      "lyceens",
      "college",
      "cycle 3",
    ],
    "communaute educative": [
      "communaute educative",
      "enseignants",
      "education",
    ],
  };
  const resourceTypeFilters = [
    {
      label: "À lire",
      aliases: [
        "article",
        "dossier",
        "bande dessinee",
        "bd",
        "fiche pedagogique",
      ],
    },
    {
      label: "À regarder",
      aliases: [
        "temoignage",
        "reportage",
        "documentaire",
        "animation",
        "video",
      ],
    },
    {
      label: "À écouter",
      aliases: [
        "podcast",
      ],
    },
    {
      label: "À expérimenter",
      aliases: [
        "jeu",
        "activite",
        "activite pedagogique",
        "atelier",
        "ressource interactive",
      ],
    },
    {
      label: "À présenter",
      aliases: [
        "exposition",
        "piece de theatre",
        "kit de mediation",
        "table ronde",
        "conference",
      ],
    },
  ];

  const normalize = (value) =>
    (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const splitValues = (value) =>
    (value || "")
      .split("||")
      .map((item) => item.trim())
      .filter(Boolean);

  const cardData = new Map(
    cards.map((card, index) => [
      card,
      {
        index,
        title: card.dataset.title || "",
        titleKey: normalize(card.dataset.title),
        date: Date.parse(card.dataset.date || "") || 0,
        search: normalize(card.dataset.search),
        tags: splitValues(card.dataset.tags),
        support: splitValues(card.dataset.support),
        cibles: splitValues(card.dataset.cibles),
        domaines: splitValues(card.dataset.domaines),
      },
    ])
  );

  const populateSelect = (select) => {
    if (select.options.length > 1) {
      return;
    }

    const field = select.dataset.resourceFilterSelect;
    const values = new Map();

    if (field === "tags") {
      resourceTypeFilters.forEach((group) => {
        const option = document.createElement("option");
        option.value = group.label;
        option.textContent = group.label;
        select.append(option);
      });
      return;
    }

    if (field === "cibles") {
      return;
    }

    cards.forEach((card) => {
      (cardData.get(card)[field] || []).forEach((value) => {
        values.set(normalize(value), value);
      });
    });

    Array.from(values.values())
      .sort((a, b) => collator.compare(a, b))
      .forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.append(option);
      });
  };

  root.querySelectorAll("[data-resource-filter-select]").forEach(populateSelect);

  const matchesSelect = (data, field, value) => {
    if (!value) {
      return true;
    }

    const normalizedValue = normalize(value);
    const typeFilter = field === "tags"
      ? resourceTypeFilters.find((group) => normalize(group.label) === normalizedValue)
      : null;
    const aliases = typeFilter?.aliases || publicFilterAliases[normalizedValue] || [normalizedValue];

    return (data[field] || []).some((item) => {
      const normalizedItem = normalize(item);
      return aliases.some((alias) => normalizedItem === alias || normalizedItem.includes(alias));
    });
  };

  const compareCards = (first, second, sortMode) => {
    const a = cardData.get(first);
    const b = cardData.get(second);

    if (sortMode === "title-asc") {
      return collator.compare(a.title, b.title) || a.index - b.index;
    }

    if (sortMode === "title-desc") {
      return collator.compare(b.title, a.title) || a.index - b.index;
    }

    if (sortMode === "date-asc") {
      return a.date - b.date || a.index - b.index;
    }

    return b.date - a.date || a.index - b.index;
  };

  const applyFilters = () => {
    const query = normalize(searchInput.value);
    const selected = {
      tags: root.querySelector('[data-resource-filter-select="tags"]').value,
      support: root.querySelector('[data-resource-filter-select="support"]').value,
      cibles: root.querySelector('[data-resource-filter-select="cibles"]').value,
    };

    const sortedCards = [...cards].sort((a, b) => compareCards(a, b, sortSelect.value));
    let visibleCount = 0;

    sortedCards.forEach((card) => {
      const data = cardData.get(card);
      const isVisible =
        (!query || data.search.includes(query)) &&
        matchesSelect(data, "tags", selected.tags) &&
        matchesSelect(data, "support", selected.support) &&
        matchesSelect(data, "cibles", selected.cibles);

      card.hidden = !isVisible;
      card.classList.toggle("is-hidden", !isVisible);
      if (isVisible) {
        visibleCount += 1;
      }
      list.append(card);
    });

    if (summary) {
      const label = visibleCount > 1 ? "ressources" : "ressource";
      summary.textContent = `${visibleCount} ${label} affichée${visibleCount > 1 ? "s" : ""}`;
    }

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  };

  root.addEventListener("input", applyFilters);
  root.addEventListener("change", applyFilters);
  root.addEventListener("reset", () => {
    window.setTimeout(applyFilters, 0);
  });

  applyFilters();
})();
