/**
 * ozDNA analytics — Plausible + GA4
 *
 * 1. Plausible: add ozdna.com in Plausible dashboard, leave PLAUSIBLE_DOMAIN as-is
 * 2. GA4: paste Measurement ID from Google Analytics → GA4_MEASUREMENT_ID
 */
(function () {
  const PLAUSIBLE_DOMAIN = "ozdna.com";
  const GA4_MEASUREMENT_ID = "";

  if (PLAUSIBLE_DOMAIN) {
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = PLAUSIBLE_DOMAIN;
    script.src = "https://plausible.io/js/script.js";
    document.head.appendChild(script);
  }

  if (GA4_MEASUREMENT_ID) {
    const loader = document.createElement("script");
    loader.async = true;
    loader.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
    document.head.appendChild(loader);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA4_MEASUREMENT_ID);
  }

  window.ozdnaTrack = function ozdnaTrack(event, props) {
    if (typeof window.plausible === "function") {
      window.plausible(event, { props: props || {} });
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", event, props || {});
    }
  };
})();
