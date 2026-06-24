document.querySelectorAll("[data-hero-slideshow]").forEach((hero) => {
  const slides = [...hero.querySelectorAll(".home-hero__slide")];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ticking = false;

  if (!prefersReducedMotion && slides.length > 1) {
    let activeIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));

    if (activeIndex < 0) {
      activeIndex = 0;
      slides[activeIndex].classList.add("is-active");
    }

    window.setInterval(() => {
      slides[activeIndex].classList.remove("is-active");
      activeIndex = (activeIndex + 1) % slides.length;
      slides[activeIndex].classList.add("is-active");
    }, 6000);
  }

  if (prefersReducedMotion) {
    return;
  }

  const updateScrollAnimation = () => {
    const heroRect = hero.getBoundingClientRect();
    const heroHeight = hero.offsetHeight || 1;
    const progress = Math.min(Math.max(-heroRect.top / heroHeight, 0), 1);
    const mediaY = progress * 42;
    const contentX = progress * -48;
    const contentY = progress * -28;
    const contentOpacity = Math.max(1 - progress * 1.35, 0);

    hero.style.setProperty("--home-hero-media-y", `${mediaY}px`);
    hero.style.setProperty("--home-hero-content-x", `${contentX}px`);
    hero.style.setProperty("--home-hero-content-y", `${contentY}px`);
    hero.style.setProperty("--home-hero-content-opacity", contentOpacity.toFixed(3));
    ticking = false;
  };

  const requestScrollAnimation = () => {
    if (!ticking) {
      window.requestAnimationFrame(updateScrollAnimation);
      ticking = true;
    }
  };

  window.addEventListener("scroll", requestScrollAnimation, { passive: true });
  window.addEventListener("resize", requestScrollAnimation);
  updateScrollAnimation();
});
