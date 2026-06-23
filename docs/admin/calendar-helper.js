(function () {
  var EVENTS_URL = new URL("../data/evenements.json", window.location.href).toString();
  var COLLECTION_HASH = "#/collections/calendrier";
  var NEWS_COLLECTION_HASH = "#/collections/actualites";
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
  var editorObserver;
  var timeDropdown;
  var activeTimeInput;
  var activeTimeIndex = -1;

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

  function normalizeTags(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(function (tag) {
      return tag;
    });
  }

  function safeColor(value) {
    if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
      return value.trim();
    }

    return "#d95e61";
  }

  function colorToRgba(color, alpha) {
    var safe = safeColor(color);
    var red = parseInt(safe.slice(1, 3), 16);
    var green = parseInt(safe.slice(3, 5), 16);
    var blue = parseInt(safe.slice(5, 7), 16);

    return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
  }

  function isoDate(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");

    return date.getFullYear() + "-" + month + "-" + day;
  }

  function timeOptions() {
    var options = [];

    for (var hour = 0; hour < 24; hour += 1) {
      for (var minute = 0; minute < 60; minute += 15) {
        options.push(String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0"));
      }
    }

    return options;
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
      allDay: event.toute_la_journee === true,
      startTime: event.toute_la_journee === true ? "" : event.heure_debut || "",
      endTime: event.toute_la_journee === true ? "" : event.heure_fin || "",
      location: event.lieu || "",
      type: event.type || "Événement",
      tags: normalizeTags(event.tags),
      color: safeColor(event.couleur || event.color),
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


  function closestNavItem(link) {
    return link.closest("li, [role='listitem']") || link.parentElement;
  }

  function findNavigationLink(hash, options) {
    var links = Array.prototype.slice.call(document.querySelectorAll("nav a[href*='" + hash + "']"));

    return links.find(function (link) {
      if (link.closest(".admin-calendar")) {
        return false;
      }

      if (options && options.excludeSection && link.closest(".admin-calendar-nav-section")) {
        return false;
      }

      return true;
    });
  }

  function syncActualitesNavigation() {
    var newsLink = findNavigationLink(NEWS_COLLECTION_HASH);
    var eventLink = findNavigationLink(COLLECTION_HASH, { excludeSection: true });
    var newsItem;
    var eventItem;
    var section;

    if (!newsLink || !eventLink) {
      return;
    }

    newsItem = closestNavItem(newsLink);
    eventItem = closestNavItem(eventLink);

    if (!newsItem || !eventItem || eventItem.closest(".admin-calendar-nav-section")) {
      return;
    }

    eventItem.classList.add("admin-calendar-nav-hidden");
    section = newsItem.querySelector(".admin-calendar-nav-section");

    if (!section) {
      section = document.createElement("div");
      section.className = "admin-calendar-nav-section";
      section.setAttribute("aria-label", "Sections Actualités");
      newsItem.appendChild(section);
    }

    if (!section.querySelector("a[href*='" + COLLECTION_HASH + "']")) {
      var sectionLink = document.createElement("a");
      sectionLink.className = "admin-calendar-nav-section__link";
      sectionLink.href = COLLECTION_HASH;
      sectionLink.textContent = "Événements";
      section.appendChild(sectionLink);
    }
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
      toute_la_journee: "false",
      type: "Événement",
      couleur: "#d95e61",
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

    if (event.allDay) {
      label += " · Toute la journée";
    } else if (event.startTime) {
      label += " · " + event.startTime;

      if (event.endTime) {
        label += "-" + event.endTime;
      }
    }

    return label;
  }

  function dispatchNativeInput(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function filteredTimeOptions(value) {
    var query = String(value || "").trim();
    var numericQuery = query.replace(":", "");

    if (!query) {
      return timeOptions();
    }

    return timeOptions().filter(function (time) {
      return time.indexOf(query) === 0 || time.replace(":", "").indexOf(numericQuery) === 0;
    });
  }

  function ensureTimeDropdown() {
    if (timeDropdown) {
      return timeDropdown;
    }

    timeDropdown = document.createElement("div");
    timeDropdown.className = "admin-event-time-menu";
    timeDropdown.setAttribute("role", "listbox");
    timeDropdown.hidden = true;
    document.body.appendChild(timeDropdown);

    document.addEventListener("mousedown", function (event) {
      if (!activeTimeInput) {
        return;
      }

      if (event.target === activeTimeInput || timeDropdown.contains(event.target)) {
        return;
      }

      closeTimeDropdown();
    });

    window.addEventListener("resize", positionTimeDropdown);
    window.addEventListener("scroll", positionTimeDropdown, true);

    return timeDropdown;
  }

  function positionTimeDropdown() {
    var rect;

    if (!activeTimeInput || !timeDropdown || timeDropdown.hidden) {
      return;
    }

    rect = activeTimeInput.getBoundingClientRect();
    timeDropdown.style.left = Math.round(rect.left) + "px";
    timeDropdown.style.top = Math.round(rect.bottom + 6) + "px";
    timeDropdown.style.width = Math.max(170, Math.round(rect.width)) + "px";
  }

  function closeTimeDropdown() {
    if (!timeDropdown) {
      return;
    }

    timeDropdown.hidden = true;
    timeDropdown.innerHTML = "";
    activeTimeInput = null;
    activeTimeIndex = -1;
  }

  function selectTimeOption(value) {
    if (!activeTimeInput) {
      return;
    }

    activeTimeInput.value = value;
    dispatchNativeInput(activeTimeInput);
    activeTimeInput.focus();
    closeTimeDropdown();
  }

  function renderTimeDropdown() {
    var options;

    if (!activeTimeInput) {
      return;
    }

    ensureTimeDropdown();
    options = filteredTimeOptions(activeTimeInput.value);

    if (!options.length) {
      options = timeOptions();
    }

    activeTimeIndex = options.indexOf(activeTimeInput.value);

    if (activeTimeIndex < 0) {
      activeTimeIndex = 0;
    }

    timeDropdown.innerHTML = "";

    options.forEach(function (time, index) {
      var option = document.createElement("button");
      option.type = "button";
      option.className = "admin-event-time-menu__option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", index === activeTimeIndex ? "true" : "false");
      option.textContent = time;
      option.addEventListener("mousedown", function (event) {
        event.preventDefault();
      });
      option.addEventListener("click", function () {
        selectTimeOption(time);
      });
      timeDropdown.appendChild(option);
    });

    timeDropdown.hidden = false;
    positionTimeDropdown();

    if (timeDropdown.children[activeTimeIndex]) {
      timeDropdown.children[activeTimeIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function moveTimeSelection(offset) {
    var options;

    if (!activeTimeInput || !timeDropdown || timeDropdown.hidden) {
      return;
    }

    options = Array.prototype.slice.call(timeDropdown.children);
    activeTimeIndex = Math.max(0, Math.min(options.length - 1, activeTimeIndex + offset));

    options.forEach(function (option, index) {
      option.setAttribute("aria-selected", index === activeTimeIndex ? "true" : "false");
    });

    if (options[activeTimeIndex]) {
      options[activeTimeIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function findInputByName(name) {
    var labels = {
      heure_debut: "Heure de début",
      heure_fin: "Heure de fin",
      toute_la_journee: "Toute la journée",
    };
    var direct = document.querySelector(
      [
        'input[name="' + name + '"]',
        'input[id*="' + name + '"]',
        'input[aria-label*="' + name + '"]',
      ].join(",")
    );
    var labelText;
    var label;
    var field;

    if (direct) {
      return direct;
    }

    labelText = labels[name];

    if (!labelText) {
      return null;
    }

    label = Array.prototype.slice.call(document.querySelectorAll("label, legend, span, p, div")).find(function (element) {
      return element.textContent.trim().replace(/\s+/g, " ") === labelText;
    });

    if (!label) {
      return null;
    }

    field = label.closest("label, fieldset, div");

    if (!field) {
      return null;
    }

    return field.querySelector("input");
  }

  function findFieldByName(name) {
    var direct = document.querySelector(
      [
        'input[name="' + name + '"]',
        'select[name="' + name + '"]',
        'input[id*="' + name + '"]',
        'select[id*="' + name + '"]',
      ].join(",")
    );

    if (direct) {
      return direct;
    }

    return findInputByName(name);
  }

  function enhanceTimeInput(name) {
    var input = findInputByName(name);
    var field;

    if (!input || input.dataset.adminTimeEnhanced === "true") {
      return input;
    }

    input.dataset.adminTimeEnhanced = "true";
    input.setAttribute("placeholder", name === "heure_debut" ? "09:00" : "17:00");
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("pattern", "([01][0-9]|2[0-3]):[0-5][0-9]");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-haspopup", "listbox");
    input.classList.add("admin-event-time-input");

    field = input.closest("label, fieldset, div");

    if (field) {
      field.classList.add("admin-event-time-field");
    }

    input.addEventListener("focus", function () {
      activeTimeInput = input;
      renderTimeDropdown();
    });

    input.addEventListener("click", function () {
      activeTimeInput = input;
      renderTimeDropdown();
    });

    input.addEventListener("input", function () {
      activeTimeInput = input;
      renderTimeDropdown();
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeTimeInput = input;
        renderTimeDropdown();
        moveTimeSelection(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeTimeInput = input;
        renderTimeDropdown();
        moveTimeSelection(-1);
      } else if (event.key === "Enter" && timeDropdown && !timeDropdown.hidden) {
        event.preventDefault();

        if (timeDropdown.children[activeTimeIndex]) {
          selectTimeOption(timeDropdown.children[activeTimeIndex].textContent);
        }
      } else if (event.key === "Escape") {
        closeTimeDropdown();
      }
    });

    return input;
  }

  function enhanceAllDayToggle() {
    var checkbox = findInputByName("toute_la_journee");
    var startInput = findFieldByName("heure_debut");
    var endInput = findFieldByName("heure_fin");

    if (!checkbox || checkbox.dataset.adminAllDayEnhanced === "true") {
      return;
    }

    checkbox.dataset.adminAllDayEnhanced = "true";

    function syncAllDay() {
      var isAllDay = checkbox.checked;

      [startInput, endInput].forEach(function (input) {
        if (!input) {
          return;
        }

        input.disabled = isAllDay;
        input.classList.toggle("is-disabled-by-all-day", isAllDay);

        if (isAllDay) {
          input.value = "";
          dispatchNativeInput(input);
        }
      });

      if (isAllDay) {
        closeTimeDropdown();
      }
    }

    checkbox.addEventListener("change", syncAllDay);
    syncAllDay();
  }

  function enhanceNativeEditor() {
    if (!window.location.hash.includes("/collections/calendrier/")) {
      return;
    }

    enhanceAllDayToggle();
  }

  function createEventButton(event, compact) {
    var button = document.createElement("button");
    var title = document.createElement("strong");
    var meta = document.createElement("span");

    button.type = "button";
    button.className = compact ? "admin-calendar__event is-compact" : "admin-calendar__event";
    button.setAttribute("aria-label", "Modifier " + event.title);
    button.style.setProperty("--event-color", event.color);
    button.style.setProperty("--event-soft-color", colorToRgba(event.color, compact ? 0.12 : 0.08));
    title.textContent = event.title;
    meta.textContent = compact ? event.startTime || event.type : eventDateLabel(event);
    button.appendChild(title);
    button.appendChild(meta);

    if (!compact && event.tags.length) {
      var tags = document.createElement("div");
      tags.className = "admin-calendar__event-tags";

      event.tags.forEach(function (tag) {
        var item = document.createElement("span");
        item.textContent = tag;
        tags.appendChild(item);
      });

      button.appendChild(tags);
    }

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
      '<p class="admin-calendar__eyebrow">Actualités</p>' +
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

      if (text !== "Événements" && text !== "Evenements" && text !== "Calendrier") {
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
    syncActualitesNavigation();
    loadEvents().then(syncRoute);
    window.addEventListener("hashchange", syncRoute);
    new MutationObserver(syncActualitesNavigation).observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("hashchange", function () {
      window.setTimeout(enhanceNativeEditor, 150);
      window.setTimeout(enhanceNativeEditor, 500);
    });
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
    editorObserver = new MutationObserver(enhanceNativeEditor);
    editorObserver.observe(document.body, { childList: true, subtree: true });
    enhanceNativeEditor();
  });
})();
