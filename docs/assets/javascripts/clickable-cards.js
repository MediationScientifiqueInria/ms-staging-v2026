document.querySelectorAll(".resource-card, .home-featured__main, .home-featured__item").forEach((card) => {
  const primaryLink = card.querySelector(
    ".resource-card__action, .home-featured__action, .resource-card__title a, .home-featured__title-row a, .resource-card__image, .home-featured__main-image, .home-featured__item-image",
  );

  if (!primaryLink) {
    return;
  }

  card.addEventListener("click", (event) => {
    if (event.target.closest("a, button, input, textarea, select, label")) {
      return;
    }

    if (window.getSelection().toString()) {
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      window.open(primaryLink.href, "_blank", "noopener");
      return;
    }

    if (primaryLink.target === "_blank") {
      window.open(primaryLink.href, "_blank", "noopener");
      return;
    }

    window.location.href = primaryLink.href;
  });
});
