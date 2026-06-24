(function () {
  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
      return;
    }

    callback();
  }

  function hidePublicationDateFields() {
    var labels = Array.prototype.slice.call(document.querySelectorAll("label, legend"));

    labels.forEach(function (label) {
      var text = label.textContent.trim().replace(/\s+/g, " ").replace(/\s*\*\s*$/, "");
      var field;
      var input;

      if (text !== "Date de publication") {
        return;
      }

      field = label.closest("label, fieldset, div");

      if (!field) {
        return;
      }

      input = field.querySelector("input");

      if (!input) {
        return;
      }

      if (input.name && input.name !== "date" && input.name !== "date_publication") {
        return;
      }

      field.classList.add("admin-hidden-publication-date");
    });
  }

  onReady(function () {
    hidePublicationDateFields();

    new MutationObserver(hidePublicationDateFields).observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
})();
