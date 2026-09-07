import { Component } from '@theme/component';

/**
 * Vertical text ticker that loops a list of words/phrases upward continuously.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} track - The scrolling track element.
 *
 * @extends Component<Refs>
 */
class VerticalTextScroll extends Component {
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
    this.#setItemHeight();
  };

  #init() {
    const { track } = this.refs;
    if (!track) return;

    // Duplicate items for seamless loop
    const items = [...track.children];
    if (items.length === 0) return;

    items.forEach((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });

    this.#setItemHeight();
  }

  #setItemHeight() {
    const { track } = this.refs;
    if (!track) return;

    const firstItem = track.querySelector('.vts__item');
    if (!firstItem) return;

    const itemHeight = firstItem.offsetHeight;
    const originalCount = track.querySelectorAll('.vts__item:not([aria-hidden])').length;

    this.style.setProperty('--vts-item-height', `${itemHeight}px`);
    this.style.setProperty('--vts-total-height', `${itemHeight * originalCount}px`);
  }
}

customElements.define('vertical-text-scroll', VerticalTextScroll);
