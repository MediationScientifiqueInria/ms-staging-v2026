document.querySelectorAll("[data-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-carousel-track]");
  const previous = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");

  if (!track || !previous || !next) {
    return;
  }

  const scrollAmount = () => {
    const firstItem = track.firstElementChild;

    if (!firstItem) {
      return track.clientWidth;
    }

    const gap = Number.parseFloat(getComputedStyle(track).columnGap || "0");
    return firstItem.getBoundingClientRect().width + gap;
  };

  const updateButtons = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    const isStatic = maxScroll <= 2;

    carousel.classList.toggle("is-static", isStatic);
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= maxScroll - 2;
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
