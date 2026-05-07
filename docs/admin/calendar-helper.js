(function () {
  var EVENTS_URL = new URL("../data/evenements.json", window.location.href).toString();
  var COLLECTION_HASH = "#/collections/calendrier";
  var locale = "fr-FR";
  var today = startOfDay(new Date());
  var events = [];
  var isLoaded = false;
  var previousTheme;
  var state = {
    monthDate: new Date(today.getFullYear(), today.getMonth(), 1),
  };
  var root;
  var nativeReturnButton;

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
      return;
    }

    callback();
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function parseDate(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    var parts = value.split("T")[0].split("-");

    if (parts.length !== 3) {
      return null;
    }

    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function isoDate(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");

    return date.getFullYear() + "-" + month + "-" + day;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function formatMonth(date) {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function sameDay(first, second) {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  function isDateInRange(date, event) {
    return date >= event.start && date <= event.end;
  }

  function normalizeEvent(event) {
    var start = parseDate(event.date_debut || event.date);
    var end = parseDate(event.date_fin);

    if (!start) {
      return null;
    }

    if (!end || end < start) {
      end = start;
    }

    return {
      id: event.entry_id || event.slug || "",
      title: event.title || event.titre || "Événement",
      description: event.description || "",
      start: start,
      end: end,
      startTime: event.heure_debut || "",
      endTime: event.heure_fin || "",
      location: event.lieu || "",
      type: event.type || "Événement",
      published: event.publie !== false,
    };
  }

  function isCalendarCollectionRoute() {
    var hash = window.location.hash.split("?")[0].replace(/\/$/, "");

    return hash === COLLECTION_HASH;
  }

  function isNativeCollectionRoute() {
    var params = new URLSearchParams(window.location.hash.split("?")[1] || "");

    return isCalendarCollectionRoute() && params.has("list");
  }

  function updateNavigationWidth() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll("nav, [role='navigation']"));
    var navigation = candidates.find(function (element) {
      var rect = element.getBoundingClientRect();

      return rect.left <= 1 && rect.width >= 56 && rect.width <= 320;
    });
    var width;

    if (!navigation) {
      return;
    }

    width = Math.round(navigation.getBoundingClientRect().right);
    width = Math.max(72, Math.min(width, 230));

    document.documentElement.style.setProperty(
      "--admin-calendar-nav-width",
      width + "px"
    );
  }

  function clearNativeMasks() {
    document.querySelectorAll(".admin-calendar-native-hidden").forEach(function (element) {
      element.classList.remove("admin-calendar-native-hidden");
    });
  }

  function hideNativeCollectionView() {
    var navWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--admin-calendar-nav-width")) || 0;
    var candidates = Array.prototype.slice.call(
      document.body.querySelectorAll("main, section, article, aside, [role='main'], [data-testid], .main")
    );

    clearNativeMasks();

    candidates.forEach(function (element) {
      var rect;

      if (element === root || element.contains(root) || root.contains(element)) {
        return;
      }

      rect = element.getBoundingClientRect();

      if (rect.width < 120 || rect.height < 120) {
        return;
      }

      if (rect.left < navWidth - 8) {
        return;
      }

      element.classList.add("admin-calendar-native-hidden");
    });
  }

  function openNewEvent(date) {
    var params = new URLSearchParams({
      date_debut: isoDate(date),
      date_fin: isoDate(date),
      publie: "true",
      type: "Événement",
      libelle_lien: "En savoir plus",
    });

    window.location.hash = "/collections/calendrier/new?" + params.toString();
  }

  function openEvent(event) {
    if (!event.id) {
      return;
    }

    window.location.hash = "/collections/calendrier/entries/" + encodeURIComponent(event.id);
  }

  function monthRange() {
    return {
      start: new Date(state.monthDate.getFullYear(), state.monthDate.getMonth(), 1),
      end: new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() + 1, 0),
    };
  }

  function monthEvents() {
    var range = monthRange();

    return events.filter(function (event) {
      return event.start <= range.end && event.end >= range.start;
    });
  }

  function dayEvents(date) {
    return events.filter(function (event) {
      return isDateInRange(date, event);
    });
  }

  function eventDateLabel(event) {
    var label = formatDate(event.start);

    if (!sameDay(event.start, event.end)) {
      label += " → " + formatDate(event.end);
    }

    if (event.startTime) {
      label += " · " + event.startTime;

      if (event.endTime) {
        label += "-" + event.endTime;
      }
    }

    return label;
  }

  function createEventButton(event, compact) {
    var button = document.createElement("button");
    var title = document.createElement("strong");
    var meta = document.createElement("span");

    button.type = "button";
    button.className = compact ? "admin-calendar__event is-compact" : "admin-calendar__event";
    button.setAttribute("aria-label", "Modifier " + event.title);
    title.textContent = event.title;
    meta.textContent = compact ? event.startTime || event.type : eventDateLabel(event);
    button.appendChild(title);
    button.appendChild(meta);

    if (!event.published) {
      button.classList.add("is-unpublished");
    }

    button.addEventListener("click", function (clickEvent) {
      clickEvent.stopPropagation();
      openEvent(event);
    });

    return button;
  }

  function renderList() {
    var list = root.querySelector("[data-admin-calendar-list]");
    var visibleEvents = monthEvents();

    list.innerHTML = "";

    if (!visibleEvents.length) {
      var empty = document.createElement("p");
      empty.className = "admin-calendar__empty";
      empty.textContent = "Aucun événement pour ce mois.";
      list.appendChild(empty);
      return;
    }

    visibleEvents.forEach(function (event) {
      list.appendChild(createEventButton(event, false));
    });
  }

  function renderGrid() {
    var monthLabel = root.querySelector("[data-admin-calendar-month]");
    var grid = root.querySelector("[data-admin-calendar-grid]");
    var range = monthRange();
    var calendarStart = new Date(range.start);
    var offset = (calendarStart.getDay() + 6) % 7;

    calendarStart.setDate(calendarStart.getDate() - offset);
    monthLabel.textContent = formatMonth(state.monthDate);
    grid.innerHTML = "";

    for (var index = 0; index < 42; index += 1) {
      var date = new Date(calendarStart);
      var day = document.createElement("div");
      var dayNumber = document.createElement("span");
      var dayEventsList = document.createElement("div");
      var visibleEvents;

      date.setDate(calendarStart.getDate() + index);
      visibleEvents = dayEvents(date);

      day.className = "admin-calendar__day";
      day.setAttribute("role", "button");
      day.setAttribute("tabindex", "0");
      day.setAttribute("aria-label", "Créer un événement le " + formatDate(date));
      dayNumber.className = "admin-calendar__day-number";
      dayNumber.textContent = String(date.getDate());
      dayEventsList.className = "admin-calendar__day-events";
      day.appendChild(dayNumber);
      day.appendChild(dayEventsList);

      if (date < range.start || date > range.end) {
        day.classList.add("is-outside");
      }

      if (sameDay(date, today)) {
        day.classList.add("is-today");
      }

      visibleEvents.slice(0, 3).forEach(function (event) {
        dayEventsList.appendChild(createEventButton(event, true));
      });

      if (visibleEvents.length > 3) {
        var more = document.createElement("span");
        more.className = "admin-calendar__more";
        more.textContent = "+" + (visibleEvents.length - 3);
        dayEventsList.appendChild(more);
      }

      day.addEventListener(
        "click",
        (function (selectedDate) {
          return function () {
            openNewEvent(selectedDate);
          };
        })(date)
      );
      day.addEventListener(
        "keydown",
        (function (selectedDate) {
          return function (event) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openNewEvent(selectedDate);
            }
          };
        })(date)
      );

      grid.appendChild(day);
    }
  }

  function render() {
    if (!root) {
      return;
    }

    if (!isLoaded) {
      return;
    }

    renderGrid();
    renderList();
  }

  function loadEvents() {
    return fetch(EVENTS_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Agenda indisponible");
        }

        return response.json();
      })
      .then(function (data) {
        events = (Array.isArray(data.evenements) ? data.evenements : [])
          .map(normalizeEvent)
          .filter(Boolean)
          .sort(function (first, second) {
            return first.start - second.start || first.title.localeCompare(second.title, locale);
          });
        isLoaded = true;
        render();
      })
      .catch(function () {
        events = [];
        isLoaded = true;
        render();
      });
  }

  function createCalendar() {
    root = document.createElement("section");
    root.className = "admin-calendar";
    root.innerHTML =
      '<div class="admin-calendar__shell">' +
      '<header class="admin-calendar__header">' +
      '<div>' +
      '<p class="admin-calendar__eyebrow">Calendrier</p>' +
      '<div class="admin-calendar__title-row">' +
      '<h1>Agenda des événements</h1>' +
      '<a class="admin-calendar__native-link" href="#/collections/calendrier?list=1">Vue native</a>' +
      "</div>" +
      "</div>" +
      '<div class="admin-calendar__actions">' +
      '<button class="admin-calendar__nav" type="button" data-admin-calendar-prev aria-label="Mois précédent">‹</button>' +
      '<p class="admin-calendar__month" data-admin-calendar-month></p>' +
      '<button class="admin-calendar__nav" type="button" data-admin-calendar-next aria-label="Mois suivant">›</button>' +
      '<button class="admin-calendar__today" type="button" data-admin-calendar-today>Aujourd’hui</button>' +
      "</div>" +
      "</header>" +
      '<div class="admin-calendar__body">' +
      '<div class="admin-calendar__main">' +
      '<div class="admin-calendar__weekdays" aria-hidden="true">' +
      "<span>Lun.</span><span>Mar.</span><span>Mer.</span><span>Jeu.</span><span>Ven.</span><span>Sam.</span><span>Dim.</span>" +
      "</div>" +
      '<div class="admin-calendar__grid" data-admin-calendar-grid></div>' +
      "</div>" +
      '<aside class="admin-calendar__side">' +
      '<button class="admin-calendar__create" type="button" data-admin-calendar-create>Créer un événement</button>' +
      '<p class="admin-calendar__hint">Cliquez sur une case vide pour créer un événement. Cliquez sur un événement pour le modifier.</p>' +
      '<h2>Ce mois-ci</h2>' +
      '<div class="admin-calendar__list" data-admin-calendar-list></div>' +
      "</aside>" +
      "</div>" +
      "</div>";

    document.body.appendChild(root);

    root.querySelector("[data-admin-calendar-prev]").addEventListener("click", function () {
      state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() - 1, 1);
      render();
    });

    root.querySelector("[data-admin-calendar-next]").addEventListener("click", function () {
      state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() + 1, 1);
      render();
    });

    root.querySelector("[data-admin-calendar-today]").addEventListener("click", function () {
      state.monthDate = new Date(today.getFullYear(), today.getMonth(), 1);
      render();
    });

    root.querySelector("[data-admin-calendar-create]").addEventListener("click", function () {
      openNewEvent(today);
    });
  }

  function createNativeReturnButton() {
    nativeReturnButton = document.createElement("a");
    nativeReturnButton.className = "admin-calendar__mode-return";
    nativeReturnButton.href = "#/collections/calendrier";
    nativeReturnButton.textContent = "Mode agenda";
    document.body.appendChild(nativeReturnButton);
  }

  function findNativeCalendarTitle() {
    var titles = Array.prototype.slice.call(
      document.querySelectorAll("h1, h2, h3, [role='heading']")
    );

    return titles.find(function (element) {
      var rect;
      var text = element.textContent.trim().replace(/\s+/g, " ");

      if (text !== "Calendrier") {
        return false;
      }

      if (root && (root.contains(element) || element.contains(root))) {
        return false;
      }

      rect = element.getBoundingClientRect();

      return rect.width > 0 && rect.height > 0;
    });
  }

  function resetNativeReturnButtonPosition() {
    nativeReturnButton.classList.remove("is-anchored");
    nativeReturnButton.style.left = "";
    nativeReturnButton.style.top = "";
    nativeReturnButton.style.right = "";
  }

  function placeNativeReturnButton() {
    var title;
    var titleRect;
    var buttonRect;
    var left;
    var top;

    if (!nativeReturnButton.classList.contains("is-active")) {
      resetNativeReturnButtonPosition();
      return;
    }

    title = findNativeCalendarTitle();

    if (!title) {
      resetNativeReturnButtonPosition();
      return;
    }

    titleRect = title.getBoundingClientRect();
    buttonRect = nativeReturnButton.getBoundingClientRect();
    left = Math.min(titleRect.right + 12, window.innerWidth - buttonRect.width - 16);
    top = Math.max(12, titleRect.top + (titleRect.height - buttonRect.height) / 2);

    nativeReturnButton.classList.add("is-anchored");
    nativeReturnButton.style.left = Math.round(left) + "px";
    nativeReturnButton.style.top = Math.round(top) + "px";
    nativeReturnButton.style.right = "auto";
  }

  function scheduleNativeReturnButtonPlacement() {
    placeNativeReturnButton();
    window.setTimeout(placeNativeReturnButton, 120);
    window.setTimeout(placeNativeReturnButton, 360);
  }

  function syncRoute() {
    var showCalendar = isCalendarCollectionRoute() && !isNativeCollectionRoute();
    var showNative = isNativeCollectionRoute();

    if (!root) {
      return;
    }

    root.classList.toggle("is-active", showCalendar);
    nativeReturnButton.classList.toggle("is-active", showNative);
    scheduleNativeReturnButtonPlacement();
    document.documentElement.classList.toggle("admin-calendar-route", showCalendar);

    if (showCalendar) {
      if (previousTheme === undefined) {
        previousTheme = document.documentElement.getAttribute("data-theme");
      }

      document.documentElement.setAttribute("data-theme", "light");
      updateNavigationWidth();
      hideNativeCollectionView();
    } else if (previousTheme !== undefined) {
      clearNativeMasks();

      if (previousTheme) {
        document.documentElement.setAttribute("data-theme", previousTheme);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }

      previousTheme = undefined;
    }

    if (showCalendar) {
      loadEvents();
    }
  }

  onReady(function () {
    createCalendar();
    createNativeReturnButton();
    loadEvents().then(syncRoute);
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("resize", function () {
      if (isCalendarCollectionRoute()) {
        updateNavigationWidth();
        hideNativeCollectionView();
      }

      if (isNativeCollectionRoute()) {
        placeNativeReturnButton();
      }
    });
    window.addEventListener("scroll", function () {
      if (isNativeCollectionRoute()) {
        placeNativeReturnButton();
      }
    }, true);
    window.addEventListener("focus", function () {
      if (isCalendarCollectionRoute()) {
        loadEvents();
      }
    });
  });
})();
