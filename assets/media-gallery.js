import { Component } from '@theme/component';
import { ThemeEvents, VariantUpdateEvent, ZoomMediaSelectedEvent } from '@theme/events';

/**
 * A custom element that renders a media gallery.
 *
 * @typedef {object} Refs
 * @property {import('./zoom-dialog').ZoomDialog} [zoomDialogComponent] - The zoom dialog component.
 * @property {import('./slideshow').Slideshow} [slideshow] - The slideshow component.
 * @property {HTMLElement[]} [media] - The media elements.
 *
 * @extends Component<Refs>
 */
export class MediaGallery extends Component {
  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#controller;
    const target = this.closest('.shopify-section, dialog');

    target?.addEventListener(ThemeEvents.variantUpdate, this.#handleVariantUpdate, { signal });
    document.addEventListener(ThemeEvents.variantUpdate, this.#handleDocumentVariantUpdate, { signal });
    this.refs.zoomDialogComponent?.addEventListener(ThemeEvents.zoomMediaSelected, this.#handleZoomMediaSelected, {
      signal,
    });
  }

  #controller = new AbortController();

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#controller.abort();
  }

  /**
   * Handles variant:update events dispatched on document (e.g. quantity break variant pickers).
   *
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #handleDocumentVariantUpdate = (event) => {
    if (event.detail?.data?.html) return;
    this.#selectVariantMedia(event);
  };

  /**
   * Handles a variant update event by replacing the current media gallery with a new one.
   *
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #handleVariantUpdate = (event) => {
    const source = event.detail.data?.html;

    if (source) {
      const newMediaGallery = source.querySelector('media-gallery');

      if (!newMediaGallery) return;

      if (
        this.dataset.presentation === 'grid' &&
        (newMediaGallery.dataset.presentation !== 'grid' || !newMediaGallery.querySelector('.media-gallery__grid'))
      ) {
        this.#selectVariantMedia(event);
        return;
      }

      this.replaceWith(newMediaGallery);
      return;
    }

    this.#selectVariantMedia(event);
  };

  /**
   * @param {string} imageUrl
   * @returns {string}
   */
  #normalizeImagePath(imageUrl) {
    try {
      const parsed = new URL(imageUrl, window.location.origin);
      parsed.searchParams.delete('width');
      parsed.searchParams.delete('height');
      return parsed.pathname;
    } catch (_) {
      return imageUrl.split('?')[0];
    }
  }

  /**
   * Selects the gallery slide that matches the variant's featured media.
   *
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #selectVariantMedia(event) {
    if (this.presentation === 'grid') {
      this.#selectGridVariantMedia(event);
      return;
    }

    const mediaId = event.detail?.resource?.featured_media?.id;
    const imageUrl = event.detail?.resource?.featured_media?.preview_image?.src
      || event.detail?.resource?.featured_image;
    if (!mediaId && !imageUrl) return;

    const targetId = mediaId ? String(mediaId) : null;
    const { slideshow } = this;
    if (!slideshow) return;

    const slides = Array.from(slideshow.querySelectorAll('slideshow-slide'));
    const normalizedTargetUrl = imageUrl ? this.#normalizeImagePath(imageUrl) : null;

    for (let index = 0; index < slides.length; index++) {
      const slide = slides[index];
      const slideMediaId =
        slide.getAttribute('slide-id') || slide.querySelector('[data-media-id]')?.getAttribute('data-media-id');

      const isMatch = (targetId && slideMediaId === targetId) || (() => {
        if (!normalizedTargetUrl) return false;
        const image = slide.querySelector('img');
        const imagePath = image?.currentSrc || image?.src;
        if (!imagePath) return false;
        return this.#normalizeImagePath(imagePath) === normalizedTargetUrl;
      })();

      if (!isMatch) continue;

      if (slide.hasAttribute('hidden')) {
        slide.setAttribute('reveal', '');
        slide.setAttribute('aria-hidden', 'false');
      }

      if (slideMediaId) {
        slideshow.select({ id: slideMediaId }, undefined, { animate: false });
      }

      const visibleIndex = slideshow.slides?.indexOf(slide);
      if (visibleIndex != null && visibleIndex >= 0) {
        slideshow.select(visibleIndex, undefined, { animate: false });
      } else {
        slideshow.select(index, undefined, { animate: false });
      }

      const thumbnails = this.querySelectorAll('.slideshow-controls__thumbnail');
      thumbnails[index]?.click();
      return;
    }
  }

  /**
   * Scrolls the desktop grid to the variant's featured media.
   *
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  #selectGridVariantMedia(event) {
    const mediaId = event.detail?.resource?.featured_media?.id;
    const imageUrl = event.detail?.resource?.featured_media?.preview_image?.src
      || event.detail?.resource?.featured_image;
    if (!mediaId && !imageUrl) return;

    const grid = this.querySelector('.media-gallery__grid');
    if (!grid) return;

    const targetId = mediaId ? String(mediaId) : null;
    const normalizedTargetUrl = imageUrl ? this.#normalizeImagePath(imageUrl) : null;

    for (const item of grid.querySelectorAll('.product-media-container')) {
      const itemMediaId = item.querySelector('[data-media-id]')?.getAttribute('data-media-id');
      const image = item.querySelector('img');
      const imagePath = image?.currentSrc || image?.src;
      const isMatch =
        (targetId && itemMediaId === targetId) ||
        (normalizedTargetUrl && imagePath && this.#normalizeImagePath(imagePath) === normalizedTargetUrl);

      if (!isMatch) continue;

      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
  }

  /**
   * Handles the 'zoom-media:selected' event.
   * @param {ZoomMediaSelectedEvent} event - The zoom-media:selected event.
   */
  #handleZoomMediaSelected = async (event) => {
    this.slideshow?.select(event.detail.index, undefined, { animate: false });
  };

  /**
   * Zooms the media gallery.
   *
   * @param {number} index - The index of the media to zoom.
   * @param {PointerEvent} event - The pointer event.
   */
  zoom(index, event) {
    this.refs.zoomDialogComponent?.open(index, event);
  }

  get slideshow() {
    return this.refs.slideshow;
  }

  get media() {
    return this.refs.media;
  }

  get presentation() {
    return this.dataset.presentation;
  }
}

if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', MediaGallery);
}
