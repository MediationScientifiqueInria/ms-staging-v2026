document.querySelectorAll("[data-hero-slideshow]").forEach((hero) => {
  const slides = [...hero.querySelectorAll(".home-hero__slide")];

  if (slides.length < 2) {
    return;
  }

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
});
