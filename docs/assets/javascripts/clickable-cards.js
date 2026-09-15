document.querySelectorAll(".content-card, .home-featured__main, .home-featured__item").forEach((card) => {
  const primaryLink = card.querySelector(
    ".content-card__title a, .content-card__image, .home-featured__action, .home-featured__title-row a, .home-featured__main-image, .home-featured__item-image, .content-card__action",
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
