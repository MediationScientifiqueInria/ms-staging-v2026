var _paq = window._paq = window._paq || [];

_paq.push(["trackPageView"]);
_paq.push(["enableLinkTracking"]);

(function () {
  var u = "https://matomo.inria.fr/";
  var d = document;
  var g = d.createElement("script");
  var s = d.getElementsByTagName("script")[0];

  _paq.push(["setTrackerUrl", u + "matomo.php"]);
  _paq.push(["setSiteId", "171"]);
  g.async = true;
  g.src = u + "matomo.js";
  s.parentNode.insertBefore(g, s);
})();
