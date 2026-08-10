(function () {
  const EMBED_PARAM = "embed";

  function getCanonicalUrl() {
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.delete(EMBED_PARAM);
    return url.toString();
  }

  function getEmbedUrl() {
    const url = new URL(getCanonicalUrl());
    url.searchParams.set(EMBED_PARAM, "1");
    return url.toString();
  }

  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getEmbedCode(title) {
    return `<iframe src="${escapeAttribute(getEmbedUrl())}" title="${escapeAttribute(title)}" width="100%" height="640" loading="lazy" style="border:0;"></iframe>`;
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function enableEmbedView() {
    const url = new URL(window.location.href);

    if (url.searchParams.get(EMBED_PARAM) === "1") {
      document.documentElement.classList.add("is-content-embed");
    }
  }

  function initShareBlocks() {
    document.querySelectorAll("[data-content-share]").forEach((shareBlock) => {
      const feedback = shareBlock.querySelector("[data-content-share-feedback]");
      const title = shareBlock.dataset.contentTitle || document.title;

      shareBlock.querySelectorAll("[data-content-share-copy]").forEach((button) => {
        button.addEventListener("click", async () => {
          const copyType = button.dataset.contentShareCopy;
          const value = copyType === "embed" ? getEmbedCode(title) : getCanonicalUrl();

          try {
            await copyText(value);
            if (feedback) {
              feedback.textContent = copyType === "embed" ? "Code embed copié." : "Lien copié.";
            }
          } catch (error) {
            if (feedback) {
              feedback.textContent = "Copie impossible depuis ce navigateur.";
            }
          }
        });
      });
    });
  }

  enableEmbedView();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShareBlocks);
  } else {
    initShareBlocks();
  }
})();
