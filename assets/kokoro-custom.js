/*
 * Anpassungen an Quantity Breaks, "Frequently bought together" und den
 * Bundle-Deals, ohne die grossen Original-Dateien anzufassen:
 * 1. Farbkacheln statt Dropdown (setzen nur den Wert des <select> und feuern
 *    dessen change-Event, damit Preis- und Warenkorblogik im Original bleibt).
 * 2. Ausverkaufte Farben durchgestrichen statt versteckt. In den Bundle-Karten
 *    sind sie zusaetzlich anklickbar, damit Kunden die Bilder ansehen koennen -
 *    der Hinzufuegen-Knopf wird dann gesperrt.
 * 3. "#1" wird zu "1.".
 * 4. Anteiliger Preis je Varianten-Zeile plus Gesamtpreis-Zeile in der
 *    ausgewaehlten Karte - in Format UND Groesse identisch zum Kartenpreis.
 * 5. Im FBT-Button steht der Gesamtpreis statt des Haekchens.
 * 6. Die Kartenpreise der Quantity Breaks werden auf das Shop-Geldformat
 *    gebracht. Der Block formatiert sie selbst und ignoriert dabei die
 *    Shopify-Einstellung (zeigt z.B. "€59,99" statt "59,99 €").
 */
(function () {
  const SELECTS = [
    '.quantity-breaks__variant-select',
    '.quantity-breaks__variant-option-select',
    '.fbt-variant-tiles .fbt__variant-select',
    '.kokoro-bundle-select',
  ].join(', ');

  /*
   * Bewusst KEIN Quantity-Breaks-Preis als Vorlage: genau der hat ja das
   * falsche Format. Diese Elemente rendert Shopify mit dem money-Filter.
   */
  const FORMAT_SAMPLE = '.fbt__product-sale, .fbt__discounted-total, .fbt__product-compare';

  let moneyFormat = null;

  /*
   * Prefix und Suffix werden ueber die Position der Ziffern bestimmt, nicht
   * per Zeichenklasse. Sonst verschluckt das Muster das Leerzeichen vor dem
   * Euro und aus "59,99 €" wird "59,99€".
   */
  function detectMoneyFormat() {
    const sample = document.querySelector(FORMAT_SAMPLE);
    if (!sample) return null;
    const text = sample.textContent.replace(/ /g, ' ').trim();

    const first = text.search(/\d/);
    if (first === -1) return null;
    let last = -1;
    for (let i = text.length - 1; i >= 0; i--) {
      if (text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) { last = i; break; }
    }
    if (last === -1) return null;

    const number = text.slice(first, last + 1);
    const decimal = number.lastIndexOf(',') > number.lastIndexOf('.') ? ',' : '.';

    return {
      prefix: text.slice(0, first),
      suffix: text.slice(last + 1),
      decimal: decimal,
    };
  }

  function money(cents) {
    if (!moneyFormat) moneyFormat = detectMoneyFormat();

    if (moneyFormat) {
      const locale = moneyFormat.decimal === ',' ? 'de-DE' : 'en-US';
      const number = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);
      return moneyFormat.prefix + number + moneyFormat.suffix;
    }

    const currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'EUR';
    const locale = document.documentElement.lang || 'de-DE';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(cents / 100);
    } catch (e) {
      return (cents / 100).toFixed(2);
    }
  }

  /* Liest einen Betrag aus beliebig formatiertem Text und gibt Cent zurueck. */
  function parseMoney(text) {
    const match = String(text).replace(/\s/g, '').match(/[\d.,]+/);
    if (!match) return null;
    const digits = match[0];
    const decimalIndex = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'));
    let cents;
    if (decimalIndex > -1 && digits.length - decimalIndex - 1 === 2) {
      const whole = digits.slice(0, decimalIndex).replace(/[.,]/g, '');
      const fraction = digits.slice(decimalIndex + 1);
      cents = parseInt(whole || '0', 10) * 100 + parseInt(fraction, 10);
    } else {
      cents = parseInt(digits.replace(/[.,]/g, ''), 10) * 100;
    }
    return isNaN(cents) ? null : cents;
  }

  /* Bringt die selbst formatierten Kartenpreise auf das Shop-Format. */
  function normalizeCardPrices() {
    document
      .querySelectorAll('.quantity-breaks__price, .quantity-breaks__original-price')
      .forEach(function (el) {
        if (el.querySelector('*')) return;
        const cents = parseMoney(el.textContent);
        if (cents == null) return;
        const formatted = money(cents);
        if (el.textContent.trim() !== formatted) el.textContent = formatted;
      });
  }

  /* Uebernimmt Schriftgroesse und -staerke des Kartenpreises 1:1. */
  function matchPriceTypography() {
    const priceSample = document.querySelector('.quantity-breaks__price');
    const compareSample = document.querySelector('.quantity-breaks__original-price');
    if (!priceSample) return;

    const price = getComputedStyle(priceSample);
    document.querySelectorAll('.qb-total__value').forEach(function (el) {
      el.style.fontSize = price.fontSize;
      el.style.fontWeight = price.fontWeight;
      el.style.lineHeight = price.lineHeight;
    });

    if (!compareSample) return;
    const compare = getComputedStyle(compareSample);
    document.querySelectorAll('.qb-total__value s').forEach(function (el) {
      el.style.fontSize = compare.fontSize;
      el.style.fontWeight = compare.fontWeight;
    });
  }

  function sync(select, tiles) {
    for (const tile of tiles.children) {
      tile.classList.toggle('is-active', tile.dataset.value === select.value);
    }
  }

  /*
   * Bundle-Karten: ausverkaufte Farbe darf angesehen, aber nicht gekauft
   * werden. Deshalb wird der Hinzufuegen-Knopf gesperrt, solange eine nicht
   * lieferbare Farbe gewaehlt ist.
   */
  function updateBundleAvailability(select) {
    const card = select.closest('.bundle-product-card');
    if (!card) return;
    const button = card.querySelector('.bundle-product-card__add-button');
    if (!button) return;

    const option = select.options[select.selectedIndex];
    const soldOut = !!(option && option.disabled);
    const productAvailable = card.dataset.productAvailable !== 'false';

    button.disabled = soldOut || !productAvailable;
    if (soldOut) {
      button.setAttribute('title', 'Diese Farbe ist aktuell ausverkauft');
    } else {
      button.removeAttribute('title');
    }
  }

  /*
   * Quantity Breaks liefern data-swatch-background, FBT data-variant-img,
   * die Bundle-Deals data-image.
   */
  function tileBackground(option) {
    if (option.dataset.swatchBackground) return option.dataset.swatchBackground;
    if (option.dataset.variantImg) return 'url(' + option.dataset.variantImg + ')';
    if (option.dataset.image) return 'url(' + option.dataset.image + ')';
    return null;
  }

  function tileLabel(option) {
    return (option.dataset.variantLabel || option.textContent || '').trim();
  }

  function buildTiles(select) {
    if (select.dataset.qbTiles === 'done') return;
    const options = Array.from(select.options);
    if (options.length < 2) return;

    /*
     * In den Bundle-Karten sind auch ausverkaufte Farben anklickbar. Bei den
     * Paket-Angeboten und im FBT bleiben sie gesperrt, weil dort die Auswahl
     * direkt in den Kauf laeuft.
     */
    const allowSoldOut = select.classList.contains('kokoro-bundle-select');

    const tiles = document.createElement('div');
    tiles.className = 'qb-tiles';

    for (const option of options) {
      const label = tileLabel(option);
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'qb-tile';
      tile.dataset.value = option.value;
      tile.title = option.disabled ? label + ' (ausverkauft)' : label;
      tile.setAttribute('aria-label', tile.title);

      const background = tileBackground(option);
      if (background) tile.style.setProperty('--qb-tile-bg', background);

      if (option.disabled) tile.classList.add('is-unavailable');

      if (option.disabled && !allowSoldOut) {
        tile.disabled = true;
      } else {
        tile.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          sync(select, tiles);
          updateBundleAvailability(select);
        });
      }
      tiles.appendChild(tile);
    }

    select.insertAdjacentElement('afterend', tiles);
    select.dataset.qbTiles = 'done';

    const wrapper =
      select.closest('.quantity-breaks__variant-picker-select-wrapper') || select.parentElement;
    if (wrapper) wrapper.classList.add('qb-has-tiles');

    select.addEventListener('change', function () {
      sync(select, tiles);
      updateBundleAvailability(select);
    });
    sync(select, tiles);
    updateBundleAvailability(select);
  }

  /* Aus "#1" wird "1." - idempotent, laeuft gefahrlos mehrfach. */
  function renumber() {
    document.querySelectorAll('.quantity-breaks__variant-picker-number').forEach(function (label) {
      const text = label.textContent.trim();
      if (text.charAt(0) === '#') label.textContent = text.slice(1) + '.';
    });
  }

  function ensure(parent, className, tag) {
    let el = parent.querySelector(':scope > .' + className);
    if (!el) {
      el = document.createElement(tag || 'div');
      el.className = className;
      parent.appendChild(el);
    }
    return el;
  }

  /*
   * Der Kartenpreis wird so auf die Zeilen verteilt, dass die Summe exakt
   * aufgeht - die ersten Zeilen bekommen den uebrigen Cent.
   */
  function addPrices(card) {
    const rows = card.querySelectorAll('.quantity-breaks__variant-picker-row');
    const quantity = parseInt(card.dataset.quantity, 10) || 0;
    const total = parseInt(card.dataset.finalPriceCents, 10);
    const compare = parseInt(card.dataset.comparePriceCents, 10);
    const content = card.querySelector('.quantity-breaks__content');
    const isActive = card.classList.contains('quantity-breaks__card--active');
    const existingTotal = content ? content.querySelector(':scope > .qb-total') : null;

    if (!isActive || quantity < 2) {
      if (existingTotal) existingTotal.remove();
    }

    if (!rows.length || !quantity || isNaN(total)) return;

    const base = Math.floor(total / quantity);
    const rest = total - base * quantity;
    const compareBase = isNaN(compare) ? null : Math.floor(compare / quantity);

    rows.forEach(function (row, index) {
      const priceEl = ensure(row, 'qb-row-price', 'span');
      const value = base + (index < rest ? 1 : 0);
      let html = money(value);
      if (compareBase && compare > total) {
        html += ' <s>' + money(compareBase) + '</s>';
      }
      priceEl.innerHTML = html;
    });

    if (isActive && quantity > 1 && content) {
      const totalRow = ensure(content, 'qb-total', 'div');
      let value = money(total);
      if (!isNaN(compare) && compare > total) {
        value += ' <s>' + money(compare) + '</s>';
      }
      totalRow.innerHTML = '<span class="qb-total__label">Gesamtpreis</span><span class="qb-total__value">' + value + '</span>';
    }
  }

  /*
   * Gesamtpreis in den FBT-Button spiegeln. Bewusst als eigenes span, denn der
   * Original-Block schreibt nur in [data-fbt-button-text].
   */
  function syncBundleButtonTotal() {
    document.querySelectorAll('frequently-bought-together').forEach(function (root) {
      const totalEl = root.querySelector('[data-fbt-discounted-total]');
      const button = root.querySelector('.fbt__button');
      if (!totalEl || !button) return;

      let label = button.querySelector('.fbt-button-total');
      if (!label) {
        label = document.createElement('span');
        label.className = 'fbt-button-total';
        button.appendChild(label);
      }

      const text = totalEl.textContent.trim();
      if (label.textContent !== text) label.textContent = text;
    });
  }

  function init() {
    document.querySelectorAll(SELECTS).forEach(buildTiles);
    renumber();
    normalizeCardPrices();
    document.querySelectorAll('.quantity-breaks__card').forEach(addPrices);
    matchPriceTypography();
    syncBundleButtonTotal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Auswahlwechsel: der Block setzt die aktive Klasse, wir ziehen nach. */
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.quantity-breaks__card, frequently-bought-together, .bundle-product-card')) return;
    requestAnimationFrame(init);
  });

  /* Bildschirmbreite geaendert: Schriftgroessen neu abgleichen. */
  let resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(matchPriceTypography, 150);
  });

  /* Der Theme-Editor rendert Bloecke neu, deshalb beobachten wir Nachschub. */
  let pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; init(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
