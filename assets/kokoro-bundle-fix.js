/*
 * Zwei Korrekturen fuer den Bundle-Deals-Abschnitt, ohne die 63 KB grosse
 * Abschnitts-Datei mit der Warenkorblogik anzufassen.
 *
 * 1. Doppelte Artikel verhindern
 *    sections/bundle-deals.liquid haengt am Ende:
 *      document.addEventListener('shopify:section:load', ... initBundleDeals())
 *    initBundleDeals() bindet an jeden "Zum Set hinzufuegen"-Knopf einen neuen
 *    Klick-Handler, ohne den alten zu entfernen. Jeder Neuaufbau im Editor legt
 *    einen weiteren drauf - nach dem zweiten Neuaufbau landen drei Artikel pro
 *    Klick im Set. shopify:section:load feuert nur im Theme-Editor; im Shop
 *    trat der Fehler nie auf.
 *
 * 2. Die englische Hinweiszeile verschwinden lassen
 *    Die Zeile ueber dem Fortschrittsbalken kommt aus
 *      section.settings.summary_instruction | default: 'Add [min] to ...'
 *    Sie laesst sich ueber das Feld nicht abschalten:
 *    - Ein leeres Feld gilt in Liquid als "nicht gesetzt", dann greift der
 *      englische Standardtext.
 *    - Ein Leerzeichen schneidet Shopify beim Speichern ab.
 *    - An das Ergebnis wird ausserdem IMMER ein Prozentzeichen angehaengt,
 *      aus einem Bindestrich wird also "-%".
 *    Deshalb wird die Zeile hier entfernt, wenn sie leer wirkt oder noch den
 *    unuebersetzten englischen Standardtext zeigt. Sobald eigener Text
 *    drinsteht, erscheint sie wieder.
 *    Dauerhaft abschalten laesst sie sich im Abschnitt "Kokoro: Bundle-Stil".
 */
(function () {
  if (window.kokoroBundleFix) return;
  window.kokoroBundleFix = true;

  /* Texte, die als "bitte ausblenden" gelten. */
  var HIDE_EXACT = ['', '-', '-%', '–', '–%', '—', '—%', '.', '.%', '·', '·%'];

  /* Der unuebersetzte Standardtext des Themes, in beiden Varianten. */
  var HIDE_PATTERNS = [
    /^Add\s+\d+\s+to\s+\d+\s+products?\s+to\s+proceed\s+and\s+Save\s+.*$/i,
    /^Add\s+\d+\s+to\s+\d+\s+products?\.?\s*%?$/i,
  ];

  function shouldHide(text) {
    if (HIDE_EXACT.indexOf(text) !== -1) return true;
    for (var i = 0; i < HIDE_PATTERNS.length; i++) {
      if (HIDE_PATTERNS[i].test(text)) return true;
    }
    return false;
  }

  function isBundleSection(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.classList && node.classList.contains('bundle-deals-section')) return true;
    if (typeof node.querySelector !== 'function') return false;
    return !!node.querySelector('.bundle-deals-section, .bundle-product-card__add-button');
  }

  document.addEventListener(
    'shopify:section:load',
    function (event) {
      if (!isBundleSection(event.target)) return;
      /*
       * Haelt alle weiteren Zuhoerer fuer genau dieses Ereignis auf -
       * auch die des Abschnitts, die sonst erneut binden wuerden.
       */
      event.stopImmediatePropagation();
    },
    true
  );

  function hideInstruction() {
    document.querySelectorAll('.bundle-deals__summary-instruction').forEach(function (el) {
      var text = (el.textContent || '').replace(/ /g, ' ').trim();
      el.hidden = shouldHide(text);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideInstruction);
  } else {
    hideInstruction();
  }

  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      hideInstruction();
    });
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
