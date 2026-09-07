/*
 * Ausverkaufte Farben anklickbar machen (Variantenauswahl auf der
 * Produktseite).
 *
 * Warum es drei Hebel braucht:
 *
 * 1. Das Auswahlfeld ist `disabled`.
 *    snippets/variant-main-picker.liquid setzt bei nicht lieferbaren Werten
 *    `disabled` auf das Radio-Feld.
 *
 * 2. Der Klick kommt gar nicht an.
 *    Die Theme-Stile setzen auf ausverkauften Feldern `pointer-events: none`:
 *      .variant-option__button-label--lumin:has([data-option-available=false])
 *      .variant-option--swatches-disabled
 *    Das Entfernen von `disabled` allein hilft deshalb nicht - der Klick
 *    erreicht das Feld nie.
 *
 * 3. Das Theme steigt beim Wechsel aus.
 *    assets/variant-picker.js bricht in variantChanged() ab, wenn die gewaehlte
 *    Option `disabled` ist. Deshalb wird das Attribut vor dem Ausloesen entfernt
 *    und der Wechsel danach selbst angestossen.
 *
 * Der Kaufknopf bleibt unberuehrt: Fuer eine ausverkaufte Variante zeigt das
 * Theme weiterhin "Ausverkauft". Es geht ausschliesslich ums Ansehen der Bilder.
 *
 * Gilt nur, wenn im Block "Variantenauswahl" die Einstellung
 * "Ausverkaufte Varianten anklickbar" aktiv ist. Das erkennt diese Datei am
 * Merkmal data-kokoro-enabled, das der Block auf die Felder setzt.
 */
(function () {
  if (window.kokoroVariantFix) return;
  window.kokoroVariantFix = true;

  var STYLE_ID = 'kokoro-variant-fix-style';

  /*
   * Hebt die Klicksperre auf. Bewusst nur innerhalb von variant-picker und nur
   * fuer die Beschriftungen - andere Bereiche bleiben unangetastet.
   */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      'variant-picker .variant-option__button-label,' +
      'variant-picker .variant-option__button-label--lumin,' +
      'variant-picker .variant-option__button-label .swatch,' +
      'variant-picker .variant-option__swatch,' +
      'variant-picker .variant-option--swatches-disabled {' +
      'pointer-events: auto !important;' +
      'cursor: pointer !important;' +
      '}' +
      /* Der Durchstrich liegt oben auf und wuerde den Klick abfangen. */
      'variant-picker .variant-option__strikethrough {' +
      'pointer-events: none !important;' +
      '}';
    document.head.appendChild(style);
  }

  function enable() {
    var fields = document.querySelectorAll('variant-picker input[disabled], variant-picker option[disabled]');
    fields.forEach(function (field) {
      field.disabled = false;
      field.removeAttribute('disabled');
      field.setAttribute('data-kokoro-enabled', '1');
    });
    if (fields.length) injectStyle();
  }

  /*
   * Sicherheitsnetz: Falls das Theme die Auswahl trotzdem verschluckt (weil es
   * den Picker neu aufgebaut und `disabled` wiederhergestellt hat), wird der
   * Wechsel hier von Hand ausgeloest.
   */
  document.addEventListener(
    'click',
    function (event) {
      var label = event.target.closest && event.target.closest('variant-picker .variant-option__button-label');
      if (!label) return;

      var input = label.querySelector('input[type="radio"]');
      if (!input || input.checked) return;

      var wasBlocked = input.disabled || input.hasAttribute('data-kokoro-enabled');
      if (!wasBlocked) return;

      input.disabled = false;
      input.removeAttribute('disabled');
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    true
  );

  injectStyle();
  enable();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectStyle();
      enable();
    });
  }

  /* Das Theme baut den Picker bei jedem Wechsel neu auf (morph). */
  var pending = null;
  new MutationObserver(function () {
    window.clearTimeout(pending);
    pending = window.setTimeout(enable, 40);
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled'],
  });
})();
