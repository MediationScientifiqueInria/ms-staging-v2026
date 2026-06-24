document.querySelectorAll("[data-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-carousel-track]");
  const previous = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  const dotsList = carousel.querySelector("[data-carousel-dots-list]");

  if (!track || !previous || !next) {
    return;
  }

  const items = Array.from(track.children);
  const dots = [];

  const scrollAmount = () => {
    const firstItem = track.firstElementChild;

    if (!firstItem) {
      return track.clientWidth;
    }

    const gap = Number.parseFloat(getComputedStyle(track).columnGap || "0");
    return firstItem.getBoundingClientRect().width + gap;
  };

  const activeIndex = () => {
    const amount = scrollAmount();

    if (amount <= 0) {
      return 0;
    }

    return Math.min(items.length - 1, Math.max(0, Math.round(track.scrollLeft / amount)));
  };

  const updateDots = () => {
    const current = activeIndex();

    dots.forEach((dot, index) => {
      const isActive = index === current;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
  };

  const updateButtons = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    const isStatic = maxScroll <= 2;

    carousel.classList.toggle("is-static", isStatic);
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= maxScroll - 2;
    updateDots();
  };

  let startAutoplay = () => {};
  let stopAutoplay = () => {};

  const restartAutoplay = () => {
    stopAutoplay();
    startAutoplay();
  };

  const goToPrevious = () => {
    track.scrollBy({ left: -scrollAmount(), behavior: "smooth" });
    restartAutoplay();
  };

  const goToNext = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    const shouldLoop = track.scrollLeft >= maxScroll - 2;

    track.scrollTo({
      left: shouldLoop ? 0 : track.scrollLeft + scrollAmount(),
      behavior: "smooth",
    });
    restartAutoplay();
  };

  if (dotsList && carousel.hasAttribute("data-carousel-dots")) {
    items.forEach((_, index) => {
      const dot = document.createElement("button");

      dot.className = "home-carousel__dot";
      dot.type = "button";
      dot.setAttribute("aria-label", `Afficher le contenu ${index + 1}`);
      dot.addEventListener("click", () => {
        track.scrollTo({ left: index * scrollAmount(), behavior: "smooth" });
        restartAutoplay();
      });
      dotsList.appendChild(dot);
      dots.push(dot);
    });
  }

  previous.addEventListener("click", () => {
    goToPrevious();
  });

  next.addEventListener("click", () => {
    goToNext();
  });

  track.addEventListener("scroll", updateButtons, { passive: true });
  window.addEventListener("resize", updateButtons);
  updateButtons();

  if (carousel.hasAttribute("data-carousel-autoplay")) {
    let autoplayId;
    const interval = Number.parseInt(carousel.dataset.carouselInterval || "5500", 10);

    startAutoplay = () => {
      window.clearInterval(autoplayId);

      if (carousel.classList.contains("is-static")) {
        return;
      }

      autoplayId = window.setInterval(() => {
        goToNext();
      }, interval);
    };

    stopAutoplay = () => {
      window.clearInterval(autoplayId);
    };

    carousel.addEventListener("mouseenter", stopAutoplay);
    carousel.addEventListener("mouseleave", startAutoplay);
    carousel.addEventListener("focusin", stopAutoplay);
    carousel.addEventListener("focusout", startAutoplay);
    window.addEventListener("resize", startAutoplay);
    startAutoplay();
  }
});
