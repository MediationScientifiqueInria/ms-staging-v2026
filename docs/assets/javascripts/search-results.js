const cleanResourceSearchResults = () => {
  document
    .querySelectorAll(
      '.md-search-result__link[href*="contenus/ressources/"] .md-search-result__article'
    )
    .forEach((article) => {
      Array.from(article.childNodes).forEach((node) => {
        const isTitle =
          node.nodeType === Node.ELEMENT_NODE &&
          ["H1", "H2"].includes(node.tagName);
        const isIcon =
          node.nodeType === Node.ELEMENT_NODE &&
          node.classList.contains("md-search-result__icon");
        const isTags =
          node.nodeType === Node.ELEMENT_NODE &&
          node.classList.contains("md-tags");

        if (!isTitle && !isIcon && !isTags) {
          node.remove();
        }
      });
    });
};

new MutationObserver(cleanResourceSearchResults).observe(document.body, {
  childList: true,
  subtree: true,
});

cleanResourceSearchResults();
