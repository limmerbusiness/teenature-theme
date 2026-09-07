/*
 * Zwei Anpassungen am Block "Frequently bought together":
 *
 * 1. Produkttitel kuerzen. Der Markenname steht in jedem Titel und frisst im
 *    schmalen Kaestchen den Platz weg. Welcher Text entfernt wird, steht in
 *    der Blockeinstellung "Aus Produkttiteln entfernen" und kommt als
 *    data-strip-title an. Bewusst nur in der Anzeige - Produktname, Warenkorb
 *    und Bestellung bleiben unveraendert.
 *
 * 2. Die Button-Schrift vom Warenkorb-Button uebernehmen. Gemessen statt fest
 *    eingetragen, damit es auch nach einem Wechsel der Theme-Schrift passt.
 */
(function () {
  const MAIN_BUTTON = [
    'form[data-type="add-to-cart-form"] button',
    '.product-details .button',
    'button.button',
  ].join(', ');

  function clean(text, strip) {
    let result = text;
    strip
      .split(',')
      .map(function (part) { return part.trim(); })
      .filter(Boolean)
      .forEach(function (part) {
        const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'gi'), ' ');
      });
    return result.replace(/\s{2,}/g, ' ').trim();
  }

  function stripTitles() {
    document
      .querySelectorAll('.product-block-frequently-bought-together[data-strip-title]')
      .forEach(function (root) {
        const strip = root.dataset.stripTitle;
        if (!strip) return;

        root.querySelectorAll('.fbt__product-title').forEach(function (title) {
          const original = title.dataset.originalTitle || title.textContent.trim();
          if (!title.dataset.originalTitle) title.dataset.originalTitle = original;

          const cleaned = clean(original, strip);
          if (cleaned && title.textContent.trim() !== cleaned) {
            title.textContent = cleaned;
            title.title = original;
          }
        });
      });
  }

  /* Schrift des Warenkorb-Buttons auf den Bundle-Button uebertragen. */
  function matchButtonTypography() {
    const buttons = document.querySelectorAll('.fbt__button');
    if (!buttons.length) return;

    const source = document.querySelector(MAIN_BUTTON);
    if (!source || source.classList.contains('fbt__button')) return;

    const style = getComputedStyle(source);
    buttons.forEach(function (button) {
      button.style.fontFamily = style.fontFamily;
      button.style.fontSize = style.fontSize;
      button.style.fontWeight = style.fontWeight;
      button.style.letterSpacing = style.letterSpacing;
      button.style.textTransform = style.textTransform;
      button.style.lineHeight = style.lineHeight;
    });
  }

  function run() {
    stripTitles();
    matchButtonTypography();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(matchButtonTypography, 150);
  });

  let pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      run();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
