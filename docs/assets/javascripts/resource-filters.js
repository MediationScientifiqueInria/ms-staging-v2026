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
    const field = select.dataset.resourceFilterSelect;
    const values = new Map();

    cards.forEach((card) => {
      (cardData.get(card)[field] || []).forEach((value) => {
        values.set(normalize(value), value);
      });
    });

    if (field === "tags" && Array.from(values.keys()).some((value) => value.includes("bilan"))) {
      values.set("bilan", "Bilan");
    }

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
    return (data[field] || []).some((item) => {
      const normalizedItem = normalize(item);
      return normalizedItem === normalizedValue || normalizedItem.includes(normalizedValue);
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
