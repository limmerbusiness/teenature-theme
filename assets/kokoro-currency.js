/*
 * Waehrungszeichen nach rechts.
 *
 * Der Quantity-Breaks-Block und der Bundle-Deals-Abschnitt formatieren ihre
 * Preise selbst und ignorieren dabei die Waehrungsformatierung aus den
 * Shopify-Einstellungen - sie schreiben also "€59,99", obwohl im Shop
 * "59,99 €" eingestellt ist. Die zugehoerigen Dateien sind 123 KB bzw. 63 KB
 * gross und enthalten die Kauflogik, deshalb werden sie nicht umgeschrieben.
 * Stattdessen wird hier nachtraeglich korrigiert.
 *
 * Gearbeitet wird auf Textknoten statt auf Elementen, weil die Preise in
 * verschachteltem HTML stecken.
 *
 * Schalter: Block "Quantity Breaks: Stil" -> "Waehrungszeichen rechts".
 * Er setzt --qb-currency-right auf 1 oder 0.
 */
(function () {
  const SYMBOLS = '€$£¥';
  const LEADING = new RegExp('^(\\s*)([' + SYMBOLS + '])\\s*([0-9][0-9.,\\s ]*)$');
  const SCOPE = [
    '.quantity-breaks__container',
    '.quantity-breaks__card',
    '.fbt',
    '.qb-total',
    '.qb-row-price',
    '.bundle-deals__summary',
    '.bundle-deals__checkout-button',
    '.bundle-product-card',
  ].join(', ');

  function enabled() {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--qb-currency-right')
      .trim();
    /* Ohne den Stil-Block gilt: eingeschaltet. */
    return value !== '0';
  }

  function fixNode(node) {
    const match = node.nodeValue.match(LEADING);
    if (!match) return;
    const amount = match[3].trim();
    node.nodeValue = match[1] + amount + ' ' + match[2];
  }

  function run() {
    if (!enabled()) return;

    document.querySelectorAll(SCOPE).forEach(function (root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(fixNode);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  /* Die Bloecke rechnen Preise beim Wechsel neu - dann erneut korrigieren. */
  let pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      run();
    });
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
