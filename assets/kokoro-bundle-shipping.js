/*
 * Versand-Fortschritt im Bundle statt Rabatt-Fortschritt.
 *
 * Der Abschnitt "Bundle deals" zaehlt von Haus aus ARTIKEL in Richtung eines
 * Mengenrabatts. Hier wird stattdessen der WARENWERT in Richtung kostenlosem
 * Versand angezeigt - dieselbe Mechanik wie im Warenkorb, inklusive der
 * Konfetti-Animation beim Erreichen.
 *
 * Laeuft ohne jede Einstellung mit den Werten in DEFAULTS. Wer den Abschnitt
 * "Kokoro: Bundle-Stil" einfuegt, ueberschreibt sie darueber.
 *
 * Umgesetzt ohne Eingriff in sections/bundle-deals.liquid (63 KB, enthaelt die
 * Warenkorblogik): Die Summe wird aus dem angezeigten Gesamtpreis gelesen
 * (span.bundle-deals__total-value), der Balken selbst gebaut und hinter die
 * Ueberschrift der Zusammenfassung gehaengt.
 *
 * Fuer das Konfetti werden bewusst die Klassen des Themes wiederverwendet
 * (bundle-deals__tier-progress__confetti-piece). Damit gelten Farben, Groessen
 * und die Keyframes bundle-deals-confetti-fall aus section-bundle-deals.css -
 * es sieht also exakt aus wie vorher beim Rabatt-Balken.
 */
(function () {
  if (window.kokoroBundleShipping) return;
  window.kokoroBundleShipping = true;

  var DEFAULTS = {
    threshold: 70,
    textOpen: 'Noch {betrag} bis zum kostenlosen Versand',
    textDone: 'Kostenloser Versand freigeschaltet',
    color: '#5E887E',
    colorDone: '#00A650',
    trackColor: '#ECECEC',
    barHeight: 8,
    textSize: 15,
  };

  function config() {
    var el = document.querySelector('[data-kokoro-shipping-bar]');
    if (!el) return DEFAULTS;
    if (el.getAttribute('data-kokoro-shipping-bar') === 'false') return null;

    return {
      threshold: parseFloat(el.getAttribute('data-threshold')) || DEFAULTS.threshold,
      textOpen: el.getAttribute('data-text-open') || DEFAULTS.textOpen,
      textDone: el.getAttribute('data-text-done') || DEFAULTS.textDone,
      color: el.getAttribute('data-color') || DEFAULTS.color,
      colorDone: el.getAttribute('data-color-done') || DEFAULTS.colorDone,
      trackColor: DEFAULTS.trackColor,
      barHeight: DEFAULTS.barHeight,
      textSize: DEFAULTS.textSize,
    };
  }

  var STYLE_ID = 'kokoro-shipping-style';

  function injectStyle(settings) {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      /* Der Rabatt-Fortschritt des Themes weicht dem Versand-Balken. */
      '.bundle-deals__progress,.bundle-deals__flat-progress,.bundle-deals__tier-progress{display:none!important}' +
      '.kokoro-shipping{position:relative;margin-block:8px 16px;overflow:visible}' +
      '.kokoro-shipping__text{margin:0 0 8px;font-size:' + settings.textSize + 'px;font-weight:500;line-height:1.4;position:relative;z-index:1}' +
      '.kokoro-shipping__track{height:' + settings.barHeight + 'px;border-radius:999px;background:' + settings.trackColor + ';overflow:hidden;position:relative;z-index:1}' +
      '.kokoro-shipping__fill{height:100%;width:0%;border-radius:999px;transition:width .3s ease}' +
      '.kokoro-shipping__confetti{position:absolute;inset:-10px -12px -18px -12px;pointer-events:none;overflow:visible;z-index:2;opacity:0}' +
      '.kokoro-shipping--done .kokoro-shipping__confetti{opacity:1}' +
      '.kokoro-shipping--done .bundle-deals__tier-progress__confetti-piece{opacity:1;animation:bundle-deals-confetti-fall 1.35s ease-in var(--confetti-delay,0s) both}' +
      '@media (prefers-reduced-motion: reduce){.kokoro-shipping__confetti{display:none}}';
    document.head.appendChild(style);
  }

  /* Liest einen Betrag aus beliebig formatiertem Text und gibt Cent zurueck. */
  function parseMoney(text) {
    var match = String(text).replace(/\s/g, '').match(/[\d.,]+/);
    if (!match) return null;
    var digits = match[0];
    var decimalIndex = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'));
    var cents;
    if (decimalIndex > -1 && digits.length - decimalIndex - 1 === 2) {
      var whole = digits.slice(0, decimalIndex).replace(/[.,]/g, '');
      var fraction = digits.slice(decimalIndex + 1);
      cents = parseInt(whole || '0', 10) * 100 + parseInt(fraction, 10);
    } else {
      cents = parseInt(digits.replace(/[.,]/g, ''), 10) * 100;
    }
    return isNaN(cents) ? null : cents;
  }

  function formatMoney(cents) {
    try {
      return new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100) + ' €';
    } catch (error) {
      return (cents / 100).toFixed(2) + ' €';
    }
  }

  function confettiMarkup() {
    var html = '<div class="kokoro-shipping__confetti" aria-hidden="true">';
    for (var i = 0; i < 20; i++) {
      var x = 5 + ((i * 4.7) % 90);
      var delay = ((i % 7) * 0.06).toFixed(2);
      var rotation = 200 + ((i * 37) % 260);
      html +=
        '<span class="bundle-deals__tier-progress__confetti-piece ' +
        'bundle-deals__tier-progress__confetti-piece--' + (i % 6) + '" ' +
        'style="--confetti-x:' + x.toFixed(1) + '%;--confetti-delay:' + delay + 's;' +
        '--confetti-rotation:' + rotation + 'deg"></span>';
    }
    return html + '</div>';
  }

  function build(summary) {
    var bar = summary.querySelector('.kokoro-shipping');
    if (bar) return bar;

    bar = document.createElement('div');
    bar.className = 'kokoro-shipping';
    bar.innerHTML =
      confettiMarkup() +
      '<p class="kokoro-shipping__text"></p>' +
      '<div class="kokoro-shipping__track"><div class="kokoro-shipping__fill"></div></div>';

    var heading = summary.querySelector('.bundle-deals__summary-heading');
    if (heading && heading.parentNode) {
      heading.parentNode.insertBefore(bar, heading.nextSibling);
    } else {
      summary.insertBefore(bar, summary.firstChild);
    }
    return bar;
  }

  function update() {
    var settings = config();
    if (!settings || settings.threshold <= 0) return;

    var summaries = document.querySelectorAll('.bundle-deals__summary');
    if (!summaries.length) return;

    injectStyle(settings);

    var thresholdCents = Math.round(settings.threshold * 100);

    summaries.forEach(function (summary) {
      var totalEl = summary.querySelector('.bundle-deals__total-value');
      if (!totalEl) return;

      var cents = parseMoney(totalEl.textContent);
      if (cents == null) cents = 0;

      var bar = build(summary);
      var text = bar.querySelector('.kokoro-shipping__text');
      var fill = bar.querySelector('.kokoro-shipping__fill');

      var reached = cents >= thresholdCents;
      var percent = Math.min(100, (cents / thresholdCents) * 100);

      var message = reached
        ? settings.textDone
        : settings.textOpen.replace('{betrag}', formatMoney(thresholdCents - cents));

      if (text.textContent !== message) text.textContent = message;
      fill.style.width = percent + '%';
      fill.style.background = reached ? settings.colorDone : settings.color;
      text.style.color = reached ? settings.colorDone : '';

      /*
       * Konfetti nur im Moment des Erreichens neu starten. Ohne das Entfernen
       * und erneute Setzen der Klasse laeuft die Animation kein zweites Mal,
       * wenn der Kunde unter die Schwelle rutscht und wieder darueber.
       */
      var wasDone = bar.classList.contains('kokoro-shipping--done');
      if (reached && !wasDone) {
        bar.classList.remove('kokoro-shipping--done');
        void bar.offsetWidth;
        bar.classList.add('kokoro-shipping--done');
      } else if (!reached && wasDone) {
        bar.classList.remove('kokoro-shipping--done');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    update();
  }

  /* Der Abschnitt rechnet die Summe bei jeder Aenderung neu. */
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      update();
    });
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
