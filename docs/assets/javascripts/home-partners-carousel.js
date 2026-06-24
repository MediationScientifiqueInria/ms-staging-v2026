document.querySelectorAll("[data-partners-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-partners-track]");

  if (!track) {
    return;
  }

  let animation;
  let activePointer;
  let startX = 0;
  let startTime = 0;
  let hasMoved = false;
  let keyboardResume;
  let wheelResume;

  const findAnimation = () => {
    animation = track.getAnimations().find(
      (item) => item.animationName === "home-partners-scroll",
    );
  };

  const duration = () => Number(animation?.effect.getTiming().duration) || 36000;

  const normalizeTime = (time) => {
    const total = duration();
    return ((time % total) + total) % total;
  };

  const moveBy = (pixels) => {
    if (!animation) {
      findAnimation();
    }

    if (!animation) {
      return;
    }

    const loopWidth = track.scrollWidth / 2;

    if (!loopWidth) {
      return;
    }

    const currentTime = Number(animation.currentTime) || 0;
    animation.currentTime = normalizeTime(
      currentTime + (pixels / loopWidth) * duration(),
    );
  };

  carousel.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    findAnimation();

    if (!animation) {
      return;
    }

    activePointer = event.pointerId;
    startX = event.clientX;
    startTime = Number(animation.currentTime) || 0;
    hasMoved = false;
    animation.pause();
    carousel.classList.add("is-dragging");
    carousel.setPointerCapture(event.pointerId);
  });

  carousel.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointer || !animation) {
      return;
    }

    const distance = startX - event.clientX;
    const loopWidth = track.scrollWidth / 2;

    if (Math.abs(distance) > 4) {
      hasMoved = true;
    }

    if (loopWidth) {
      animation.currentTime = normalizeTime(
        startTime + (distance / loopWidth) * duration(),
      );
    }
  });

  const endDrag = (event) => {
    if (event.pointerId !== activePointer) {
      return;
    }

    activePointer = undefined;
    carousel.classList.remove("is-dragging");

    if (carousel.hasPointerCapture(event.pointerId)) {
      carousel.releasePointerCapture(event.pointerId);
    }

    animation?.play();
  };

  carousel.addEventListener("pointerup", endDrag);
  carousel.addEventListener("pointercancel", endDrag);

  carousel.addEventListener(
    "click",
    (event) => {
      if (hasMoved) {
        event.preventDefault();
        event.stopPropagation();
        hasMoved = false;
      }
    },
    true,
  );

  carousel.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    window.clearTimeout(keyboardResume);
    moveBy(event.key === "ArrowRight" ? 120 : -120);
    animation?.pause();
    keyboardResume = window.setTimeout(() => animation?.play(), 1200);
  });

  carousel.addEventListener(
    "wheel",
    (event) => {
      const horizontalDelta = event.shiftKey ? event.deltaY : event.deltaX;

      if (
        Math.abs(horizontalDelta) < 1
        || (!event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX))
      ) {
        return;
      }

      event.preventDefault();
      window.clearTimeout(wheelResume);
      moveBy(horizontalDelta);
      animation?.pause();
      wheelResume = window.setTimeout(() => animation?.play(), 900);
    },
    { passive: false },
  );
});
