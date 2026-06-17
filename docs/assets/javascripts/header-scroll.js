(function () {
  var header;
  var lastScrollY = 0;
  var ticking = false;
  var threshold = 10;
  var minDelta = 10;
  var hero;

  function getScrollY() {
    return window.scrollY || window.pageYOffset || 0;
  }

  function setHidden(hidden) {
    if (!header) {
      return;
    }
    header.classList.toggle("site-header--hidden", hidden);
  }

  function updateHeroState(scrollY) {
    if (!header || !hero) {
      return false;
    }

    var headerHeight = header.offsetHeight || 0;
    var heroBottom = hero.getBoundingClientRect().bottom + scrollY;
    var isOverHero = scrollY < heroBottom - headerHeight;

    header.classList.toggle("site-header--transparent", isOverHero);
    return isOverHero;
  }

  function updateHeader() {
    var currentScrollY = getScrollY();
    var delta = currentScrollY - lastScrollY;
    var searchToggle = document.getElementById("__search");
    var searchIsOpen = searchToggle && searchToggle.checked;
    var isOverHero = updateHeroState(currentScrollY);

    if (isOverHero || currentScrollY <= threshold || delta < -minDelta || searchIsOpen) {
      setHidden(false);
    } else if (delta > minDelta) {
      setHidden(true);
    }

    lastScrollY = currentScrollY;
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }

  function closeSearchOnOutsideClick(event) {
    var searchToggle = document.getElementById("__search");
    var searchPanel = document.querySelector(".md-search__inner");
    var searchButton = document.querySelector(".md-header__button[for='__search']");
    var target = event.target;

    if (!searchToggle || !searchToggle.checked) {
      return;
    }

    if (target === searchToggle || target.closest("label[for='__search']")) {
      return;
    }

    if ((searchPanel && searchPanel.contains(target)) || (searchButton && searchButton.contains(target))) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    searchToggle.checked = false;
    searchToggle.dispatchEvent(new Event("change", { bubbles: true }));
    setHidden(false);
  }

  function initHeaderScroll() {
    header = document.querySelector("[data-md-component='header']");
    if (!header || header.dataset.siteScrollHeader === "true") {
      return;
    }

    header.dataset.siteScrollHeader = "true";
    hero = document.querySelector(".home-hero");
    document.documentElement.classList.toggle("site-has-home-hero", Boolean(hero));
    lastScrollY = getScrollY();
    updateHeroState(lastScrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("click", closeSearchOnOutsideClick, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeaderScroll);
  } else {
    initHeaderScroll();
  }
})();
