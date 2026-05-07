(function () {
  var locale = "fr-FR";
  var today = startOfDay(new Date());

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

    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
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

  function normalizeEvent(event) {
    var start = parseDate(event.date_debut || event.start_date || event.date);
    var end = parseDate(event.date_fin || event.end_date);

    if (!start) {
      return null;
    }

    if (!end || end < start) {
      end = start;
    }

    return {
      title: event.titre || event.title || "Événement",
      description: event.description || "",
      start: start,
      end: end,
      startTime: event.heure_debut || event.start_time || "",
      endTime: event.heure_fin || event.end_time || "",
      location: event.lieu || event.location || "",
      type: event.type || "",
      tags: normalizeTags(event.tags),
      color: safeColor(event.couleur || event.color),
      audience: Array.isArray(event.public) ? event.public : [],
      territory: event.territoire || "",
      link: event.lien || event.url || "",
      linkLabel: event.libelle_lien || "En savoir plus",
      published: event.publie !== false,
    };
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

  function createMetaItem(text) {
    var item = document.createElement("span");
    item.textContent = text;
    return item;
  }

  function createEventCard(event) {
    var card = document.createElement("article");
    card.className = "home-calendar__event";
    card.style.setProperty("--event-color", event.color);
    card.style.setProperty("--event-soft-color", colorToRgba(event.color, 0.1));

    if (event.type) {
      var type = document.createElement("p");
      type.className = "home-calendar__event-type";
      type.textContent = event.type;
      card.appendChild(type);
    }

    var title = document.createElement("h4");
    title.textContent = event.title;
    card.appendChild(title);

    if (event.tags.length) {
      var tags = document.createElement("div");
      tags.className = "home-calendar__event-tags";

      event.tags.forEach(function (tag) {
        var item = document.createElement("span");
        item.textContent = tag;
        tags.appendChild(item);
      });

      card.appendChild(tags);
    }

    var date = document.createElement("p");
    date.className = "home-calendar__event-date";
    date.textContent = eventDateLabel(event);
    card.appendChild(date);

    var meta = document.createElement("div");
    meta.className = "home-calendar__event-meta";

    if (event.location) {
      meta.appendChild(createMetaItem(event.location));
    }

    if (event.territory) {
      meta.appendChild(createMetaItem(event.territory));
    }

    if (event.audience.length) {
      meta.appendChild(createMetaItem(event.audience.join(", ")));
    }

    if (meta.childElementCount) {
      card.appendChild(meta);
    }

    if (event.description) {
      var description = document.createElement("p");
      description.className = "home-calendar__event-description";
      description.textContent = event.description;
      card.appendChild(description);
    }

    if (event.link) {
      var link = document.createElement("a");
      link.className = "home-calendar__event-link";
      link.href = event.link;
      link.textContent = event.linkLabel;

      if (/^https?:\/\//.test(event.link)) {
        link.target = "_blank";
        link.rel = "noopener";
      }

      card.appendChild(link);
    }

    return card;
  }

  function eventsForMonth(events, monthDate) {
    var monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    var monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    return events.filter(function (event) {
      return event.start <= monthEnd && event.end >= monthStart;
    });
  }

  function upcomingEvents(events) {
    return events.filter(function (event) {
      return event.end >= today;
    });
  }

  function renderEventList(root, title, status, events, selectedDate, monthDate) {
    var list = root.querySelector("[data-calendar-events]");
    var listTitle = root.querySelector("[data-calendar-list-title]");

    list.innerHTML = "";
    status.hidden = true;

    var visibleEvents = selectedDate
      ? events.filter(function (event) {
          return isDateInRange(selectedDate, event);
        })
      : eventsForMonth(events, monthDate);

    if (selectedDate) {
      listTitle.textContent = "Le " + formatDate(selectedDate);
    } else {
      listTitle.textContent = title;
    }

    if (!visibleEvents.length) {
      visibleEvents = upcomingEvents(events).slice(0, 4);
      listTitle.textContent = "À venir";
    }

    if (!visibleEvents.length) {
      status.hidden = false;
      status.textContent = "Aucun événement programmé pour le moment.";
      return;
    }

    visibleEvents.slice(0, 6).forEach(function (event) {
      list.appendChild(createEventCard(event));
    });
  }

  function renderCalendar(root, events, state) {
    var monthLabel = root.querySelector("[data-calendar-month]");
    var grid = root.querySelector("[data-calendar-grid]");
    var status = root.querySelector("[data-calendar-status]");
    var monthDate = state.monthDate;
    var monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    var monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    var calendarStart = new Date(monthStart);
    var dayOffset = (calendarStart.getDay() + 6) % 7;

    calendarStart.setDate(calendarStart.getDate() - dayOffset);
    monthLabel.textContent = formatMonth(monthDate);
    grid.innerHTML = "";

    for (var index = 0; index < 42; index += 1) {
      var date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + index);

      var dayEvents = events.filter(function (event) {
        return isDateInRange(date, event);
      });

      var button = document.createElement("button");
      button.type = "button";
      button.className = "home-calendar__day";
      button.textContent = String(date.getDate());
      button.setAttribute("aria-label", formatDate(date));

      if (date < monthStart || date > monthEnd) {
        button.classList.add("is-outside");
      }

      if (sameDay(date, today)) {
        button.classList.add("is-today");
      }

      if (state.selectedDate && sameDay(date, state.selectedDate)) {
        button.classList.add("is-selected");
      }

      if (dayEvents.length) {
        button.classList.add("has-event");
        button.style.setProperty("--event-color", dayEvents[0].color);
        button.style.setProperty("--event-soft-color", colorToRgba(dayEvents[0].color, 0.1));
        button.setAttribute(
          "aria-label",
          formatDate(date) + " - " + dayEvents.length + " événement" + (dayEvents.length > 1 ? "s" : "")
        );

        var marker = document.createElement("span");
        marker.className = "home-calendar__marker";
        button.appendChild(marker);
      }

      button.addEventListener(
        "click",
        (function (clickedDate, hasEvent) {
          return function () {
            state.selectedDate = hasEvent ? clickedDate : null;
            renderCalendar(root, events, state);
          };
        })(date, Boolean(dayEvents.length))
      );

      grid.appendChild(button);
    }

    renderEventList(root, "Ce mois-ci", status, events, state.selectedDate, monthDate);
  }

  function initHomeCalendar() {
    var root = document.querySelector("[data-home-calendar]");

    if (!root) {
      return;
    }

    var status = root.querySelector("[data-calendar-status]");
    var eventsUrl = root.getAttribute("data-events-url");

    fetch(eventsUrl)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Calendrier indisponible");
        }

        return response.json();
      })
      .then(function (data) {
        var items = Array.isArray(data.evenements) ? data.evenements : data.events || [];
        var events = items
          .map(normalizeEvent)
          .filter(Boolean)
          .filter(function (event) {
            return event.published;
          })
          .sort(function (first, second) {
            return first.start - second.start;
          });
        var nextEvent = upcomingEvents(events)[0];
        var state = {
          monthDate: nextEvent ? new Date(nextEvent.start.getFullYear(), nextEvent.start.getMonth(), 1) : today,
          selectedDate: null,
        };

        root.querySelector("[data-calendar-prev]").addEventListener("click", function () {
          state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() - 1, 1);
          state.selectedDate = null;
          renderCalendar(root, events, state);
        });

        root.querySelector("[data-calendar-next]").addEventListener("click", function () {
          state.monthDate = new Date(state.monthDate.getFullYear(), state.monthDate.getMonth() + 1, 1);
          state.selectedDate = null;
          renderCalendar(root, events, state);
        });

        renderCalendar(root, events, state);
      })
      .catch(function () {
        status.hidden = false;
        status.textContent = "Le calendrier n'est pas disponible pour le moment.";
      });
  }

  onReady(initHomeCalendar);
})();
