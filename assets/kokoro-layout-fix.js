/*
 * Bild links, Ueberschrift ueber den Aufklapp-Punkten.
 *
 * Der betroffene Abschnitt liegt in templates/product.json (213 KB). Diese
 * Datei laesst sich nicht am Stueck zurueckschreiben, deshalb wird das Layout
 * hier im Browser umgebaut - ohne Klick im Editor.
 *
 * Gesucht wird sehr eng: ein waagerechter Flex-Container, der GLEICHZEITIG
 * ein Bild und einen Aufklapp-Bereich enthaelt und mindestens drei Kinder hat.
 * Diese Kombination kommt sonst nirgends im Theme vor, deshalb trifft die
 * Regel nichts anderes.
 *
 * Ergebnis:
 *   Spalte 1: Bild, ueber beide Zeilen
 *   Spalte 2: Ueberschrift oben, Aufklapp-Punkte darunter
 * Auf dem Handy stapelt sich alles untereinander.
 */
(function () {
  if (window.kokoroLayoutFix) return;
  window.kokoroLayoutFix = true;

  var ACCORDION = 'accordion-custom, details, .tabs, [class*="tab"]';
  var MARK = 'data-kokoro-layout';

  function directChildContaining(parent, node) {
    var current = node;
    while (current && current.parentElement !== parent) {
      current = current.parentElement;
    }
    return current;
  }

  function apply() {
    var accordions = document.querySelectorAll(ACCORDION);

    accordions.forEach(function (accordion) {
      /* Vom Aufklapp-Bereich nach oben laufen, bis ein Container auch ein Bild enthaelt. */
      var container = accordion.parentElement;
      var steps = 0;

      while (container && steps < 6) {
        steps++;

        var image = container.querySelector('img');
        var hasEnoughChildren = container.children.length >= 3;

        if (image && hasEnoughChildren) {
          var style = window.getComputedStyle(container);
          var isRow = style.display === 'flex' && style.flexDirection.indexOf('row') === 0;
          var alreadyDone = container.getAttribute(MARK) === '1';

          if (isRow && !alreadyDone) {
            var mediaChild = directChildContaining(container, image);
            if (!mediaChild) return;

            container.setAttribute(MARK, '1');
            container.style.display = 'grid';
            container.style.gridTemplateColumns = '1fr 1fr';
            container.style.alignItems = 'center';
            container.style.width = '100%';
            container.style.maxWidth = '100%';

            mediaChild.style.gridRow = 'span 2';
            mediaChild.style.width = '100%';
            mediaChild.style.maxWidth = '100%';
            image.style.width = '100%';
            image.style.height = 'auto';

            injectMobileStyle();
          }
          return;
        }

        container = container.parentElement;
      }
    });
  }

  var STYLE_ID = 'kokoro-layout-fix-style';

  function injectMobileStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '@media screen and (max-width:749px){' +
      '[' + MARK + '="1"]{grid-template-columns:1fr!important}' +
      '[' + MARK + '="1"] > *{grid-row:auto!important}' +
      '}';
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  /* Der Editor baut Abschnitte neu auf. */
  var pending = null;
  new MutationObserver(function () {
    window.clearTimeout(pending);
    pending = window.setTimeout(apply, 100);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
