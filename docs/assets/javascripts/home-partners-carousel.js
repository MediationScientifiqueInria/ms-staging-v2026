document.querySelectorAll("[data-partners-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-partners-track]");

  if (!track || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  let isPaused = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let resumeTimeout;
  let lastFrame = performance.now();

  const loopWidth = () => track.scrollWidth / 2;

  const normalizeScroll = () => {
    const width = loopWidth();

    if (!width) {
      return;
    }

    const maxScroll = carousel.scrollWidth - carousel.clientWidth;

    if (carousel.scrollLeft >= maxScroll - 2) {
      carousel.scrollLeft -= width;
    } else if (carousel.scrollLeft <= 2) {
      carousel.scrollLeft += width;
    }
  };

  const pauseTemporarily = () => {
    isPaused = true;
    window.clearTimeout(resumeTimeout);
    resumeTimeout = window.setTimeout(() => {
      isPaused = false;
    }, 1800);
  };

  const tick = (now) => {
    const delta = now - lastFrame;
    lastFrame = now;

    if (!isPaused && !isDragging) {
      carousel.scrollLeft += delta * 0.035;
      normalizeScroll();
    }

    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(() => {
    carousel.scrollLeft = loopWidth();
    window.requestAnimationFrame(tick);
  });

  carousel.addEventListener("scroll", normalizeScroll, { passive: true });
  carousel.addEventListener("mouseenter", () => {
    isPaused = true;
  });
  carousel.addEventListener("mouseleave", () => {
    isPaused = false;
  });
  carousel.addEventListener("focusin", () => {
    isPaused = true;
  });
  carousel.addEventListener("focusout", () => {
    isPaused = false;
  });
  carousel.addEventListener("wheel", pauseTemporarily, { passive: true });

  carousel.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) {
      return;
    }

    isDragging = true;
    isPaused = true;
    dragStartX = event.clientX;
    dragStartScroll = carousel.scrollLeft;
    carousel.classList.add("is-dragging");
    carousel.setPointerCapture(event.pointerId);
  });

  carousel.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    event.preventDefault();
    carousel.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
  });

  const endDrag = (event) => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    carousel.classList.remove("is-dragging");
    carousel.releasePointerCapture(event.pointerId);
    pauseTemporarily();
  };

  carousel.addEventListener("pointerup", endDrag);
  carousel.addEventListener("pointercancel", endDrag);
});
