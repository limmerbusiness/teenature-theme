import { Component } from '@theme/component';

/**
 * Horizontal text ticker that loops a list of words/phrases continuously.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} track - The scrolling track element.
 *
 * @extends Component<Refs>
 */
class HorizontalTextScroll extends Component {
  requiredRefs = ['track'];

  connectedCallback() {
    super.connectedCallback();
    this.#init();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.addEventListener('resize', this.#onResize);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.#onResize);
  }

  #onResize = () => {
    this.#setTrackWidth();
  };

  #init() {
    const { track } = this.refs;
    if (!track) return;

    const items = [...track.children];
    if (items.length === 0) return;

    items.forEach((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });

    this.#setTrackWidth();
  }

  #setTrackWidth() {
    const { track } = this.refs;
    if (!track) return;

    const originalItems = track.querySelectorAll('.hts__item:not([aria-hidden])');
    if (originalItems.length === 0) return;

    let totalWidth = 0;
    originalItems.forEach((item) => {
      totalWidth += item.offsetWidth;
    });

    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap) || 0;
    totalWidth += gap * originalItems.length;

    this.style.setProperty('--hts-total-width', `${totalWidth}px`);
  }
}

customElements.define('horizontal-text-scroll', HorizontalTextScroll);
