import { ThemeEvents, VariantUpdateEvent } from '@theme/events';

/**
 * A custom element that displays a product price.
 * This component listens for variant update events and updates the price display accordingly.
 * It handles price updates from two different sources:
 * 1. Variant picker (in quick add modal or product page)
 * 2. Swatches variant picker (in product cards)
 */
class ProductPrice extends HTMLElement {
  /**
   * Format cents as money string using theme format or Intl.
   * @param {number} cents
   * @returns {string}
   */
  static formatMoneyCents(cents) {
    const theme = typeof window.Theme !== 'undefined' ? window.Theme : null;
    if (theme && typeof theme.formatMoney === 'function') {
      return theme.formatMoney(cents);
    }

    const amount = Number(cents) / 100;
    const currency = theme?.currency || 'USD';
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Format cents as product-page price-split HTML for compare/sale display.
   * @param {number} cents
   * @param {string} [context='product_page']
   * @returns {string}
   */
  static formatPriceSplitCents(cents, context = 'product_page') {
    const theme = typeof window.Theme !== 'undefined' ? window.Theme : null;
    if (theme?.formatPriceSplitHTML) {
      return theme.formatPriceSplitHTML(Number(cents), false, context);
    }
    return ProductPrice.formatMoneyCents(cents);
  }

  /**
   * @param {{ type: 'full' | 'simple', showTotalPricing?: boolean }} source
   * @param {HTMLElement} activeElement
   * @returns {number}
   */
  getQuantityBreakPriceCents(source, activeElement) {
    let priceCents = parseInt(activeElement.dataset.finalPriceCents || activeElement.dataset.priceCents || '0', 10);
    const showPerUnit = source.type === 'full'
      ? activeElement.dataset.showPerUnit === 'true'
      : source.showTotalPricing === false
        && activeElement.closest('[data-tiered-quantity-component]')?.dataset.showPerUnit === 'true';
    const quantity = parseInt(activeElement.dataset.quantity || '1', 10);

    if (showPerUnit && quantity > 0) {
      priceCents = Math.round(priceCents / quantity);
    }

    return priceCents;
  }

  /**
   * @param {{ type: 'full' | 'simple', showTotalPricing?: boolean }} source
   * @param {HTMLElement} activeElement
   * @returns {number}
   */
  getQuantityBreakCompareCents(source, activeElement) {
    let compareCents = parseInt(activeElement.dataset.comparePriceCents || activeElement.dataset.compareCents || '0', 10);
    if (!compareCents) return 0;

    const showPerUnit = source.type === 'full'
      ? activeElement.dataset.showPerUnit === 'true'
      : source.showTotalPricing === false
        && activeElement.closest('[data-tiered-quantity-component]')?.dataset.showPerUnit === 'true';
    const quantity = parseInt(activeElement.dataset.quantity || '1', 10);

    if (showPerUnit && quantity > 0) {
      compareCents = Math.round(compareCents / quantity);
    }

    return compareCents;
  }

  connectedCallback() {
    const closestSection = this.closest('.shopify-section, dialog');
    if (!closestSection) return;
    closestSection.addEventListener(ThemeEvents.variantUpdate, this.updatePrice);
    this.documentVariantUpdateHandler = this.handleDocumentVariantUpdate.bind(this);
    document.addEventListener(ThemeEvents.variantUpdate, this.documentVariantUpdateHandler);
    
    // Set up quantity breaks price listener
    this.setupQuantityBreaksListener();
    
    // Check for quantity breaks price on initial load
    setTimeout(() => this.updatePriceFromQuantityBreaks(), 100);
  }

  disconnectedCallback() {
    const closestSection = this.closest('.shopify-section, dialog');
    if (!closestSection) return;
    closestSection.removeEventListener(ThemeEvents.variantUpdate, this.updatePrice);
    if (this.documentVariantUpdateHandler) {
      document.removeEventListener(ThemeEvents.variantUpdate, this.documentVariantUpdateHandler);
    }
    
    // Clean up quantity breaks listeners
    if (this.quantityBreaksClickHandler) {
      document.removeEventListener('click', this.quantityBreaksClickHandler);
    }
    if (this.quantityBreaksVariantChangeHandler) {
      document.removeEventListener('change', this.quantityBreaksVariantChangeHandler);
    }
    if (this.quantityBreaksObserver) {
      this.quantityBreaksObserver.disconnect();
    }
  }

  /**
   * Sets up listener for quantity breaks card selection
   */
  setupQuantityBreaksListener() {
    // Listen for clicks on quantity break cards
    this.quantityBreaksClickHandler = (event) => {
      const clickedCard = event.target.closest('.quantity-breaks__card');
      const clickedTieredOption = event.target.closest('.tiered-option');
      if (!clickedCard && !clickedTieredOption) return;

      const closestSection = this.closest('.shopify-section, dialog');
      const clickedElement = clickedCard || clickedTieredOption;
      const cardSection = clickedElement?.closest('.shopify-section, dialog');
      if (closestSection && cardSection && closestSection === cardSection) {
        setTimeout(() => this.updatePriceFromQuantityBreaks(), 50);
      }
    };
    document.addEventListener('click', this.quantityBreaksClickHandler);

    // Variant pickers inside quantity break cards dispatch on document, not the section
    this.quantityBreaksVariantChangeHandler = (event) => {
      const select = event.target.closest('[data-variant-select], [data-variant-option-select]');
      if (!select) return;

      const closestSection = this.closest('.shopify-section, dialog');
      const selectSection = select.closest('.shopify-section, dialog');
      if (!closestSection || !selectSection || closestSection !== selectSection) return;

      const card = select.closest('.quantity-breaks__card');
      if (!card?.classList.contains('quantity-breaks__card--active')) return;

      setTimeout(() => this.updatePriceFromQuantityBreaks(), 50);
    };
    document.addEventListener('change', this.quantityBreaksVariantChangeHandler);
    
    // Watch for active class changes on quantity break cards within the same section
    const closestSection = this.closest('.shopify-section, dialog');
    if (closestSection) {
      const quantityBreaksComponent = closestSection.querySelector('[data-quantity-breaks-component]');
      const tieredComponent = closestSection.querySelector('[data-tiered-quantity-component]');
      const observeTarget = quantityBreaksComponent || tieredComponent?.querySelector('[data-tiered-quantity-block-id]');

      if (observeTarget) {
        this.quantityBreaksObserver = new MutationObserver((mutations) => {
          const shouldUpdate = mutations.some((mutation) => {
            if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return false;
            const target = mutation.target;
            return target.classList.contains('quantity-breaks__card')
              || target.classList.contains('tiered-option');
          });

          if (shouldUpdate) {
            this.updatePriceFromQuantityBreaks();
          }
        });

        this.quantityBreaksObserver.observe(observeTarget, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class'],
        });
      }
    }
  }

  /**
   * Finds the active quantity break source in the same section (full or simple tiered).
   * @param {Element | null} section
   * @returns {{ type: 'full' | 'simple', activeElement: HTMLElement, priceElement: Element | null, compareElement: Element | null, showTotalPricing?: boolean } | null}
   */
  getActiveQuantityBreakSource(section) {
    if (!section) return null;

    const fullComponent = section.querySelector('[data-quantity-breaks-component]');
    if (fullComponent?.dataset.overrideProductPrice === 'true') {
      const activeCard = fullComponent.querySelector('.quantity-breaks__card--active');
      if (!activeCard) return null;
      const priceElement = activeCard.querySelector('.quantity-breaks__price');
      if (!priceElement) return null;
      return {
        type: 'full',
        activeElement: activeCard,
        priceElement,
        compareElement: activeCard.querySelector('.quantity-breaks__original-price'),
      };
    }

    const tieredComponent = section.querySelector('[data-tiered-quantity-component]');
    if (tieredComponent?.dataset.overrideProductPrice === 'true') {
      const activeOption = tieredComponent.querySelector('.tiered-option--active');
      if (!activeOption) return null;
      return {
        type: 'simple',
        activeElement: activeOption,
        priceElement: activeOption.querySelector('.tiered-option__final-price')
          || activeOption.querySelector('.tiered-option__per-unit'),
        compareElement: activeOption.querySelector('.tiered-option__compare-price'),
        showTotalPricing: tieredComponent.dataset.showTotalPricing !== 'false',
      };
    }

    return null;
  }

  /**
   * Updates the sale badge based on quantity break card pricing.
   * @param {HTMLElement} activeElement
   * @param {Element | null | undefined} quantityComparePriceElement
   * @param {'full' | 'simple'} [sourceType='full']
   */
  updateSaleBadgeFromQuantityBreaks(activeElement, quantityComparePriceElement, sourceType = 'full') {
    const showSaleBadge = this.dataset.showSaleBadge === 'true';
    const priceContainer = this.querySelector('[ref="priceContainer"]');
    const currentBadge = priceContainer?.querySelector('.sale-badge') || this.querySelector('.sale-badge');

    const priceCents = this.getQuantityBreakPriceCents(
      { type: sourceType, showTotalPricing: sourceType === 'simple' ? activeElement.closest('[data-tiered-quantity-component]')?.dataset.showTotalPricing !== 'false' : undefined },
      activeElement
    );
    const compareCents = this.getQuantityBreakCompareCents(
      { type: sourceType, showTotalPricing: sourceType === 'simple' ? activeElement.closest('[data-tiered-quantity-component]')?.dataset.showTotalPricing !== 'false' : undefined },
      activeElement
    );
    const hasCompare = quantityComparePriceElement || compareCents > priceCents;

    if (!showSaleBadge || !hasCompare || compareCents <= priceCents) {
      currentBadge?.remove();
      return;
    }

    const savingsAmount = compareCents - priceCents;
    const savingsPercent = Math.round((savingsAmount * 100) / compareCents);
    const badgeType = this.dataset.saleBadgeType || 'percentage';
    const badgeLabel = this.dataset.saleBadgeLabel || 'Save';

    const badge = currentBadge ?? document.createElement('span');
    if (!currentBadge) {
      badge.className = 'sale-badge';
      badge.setAttribute('role', 'status');
    }

    if (badgeType === 'amount') {
      const theme = typeof window.Theme !== 'undefined' ? window.Theme : null;
      if (theme?.formatPriceSplitHTML) {
        badge.innerHTML = `${badgeLabel}${theme.formatPriceSplitHTML(savingsAmount, false, 'product_page')}`;
      } else {
        badge.textContent = `${badgeLabel}${ProductPrice.formatMoneyCents(savingsAmount)}`;
      }
    } else {
      badge.textContent = `${badgeLabel} ${savingsPercent}%`;
    }

    if (!currentBadge && priceContainer) {
      priceContainer.appendChild(badge);
    } else if (currentBadge && priceContainer && !priceContainer.contains(currentBadge)) {
      priceContainer.appendChild(badge);
    }
  }

  /**
   * Updates price from quantity breaks if block is present and a card is selected
   */
  updatePriceFromQuantityBreaks() {
    // Debounce to prevent rapid successive calls
    if (this._updatingPrice) return;
    this._updatingPrice = true;
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      try {
        // Find quantity breaks component within the same section only
        const closestSection = this.closest('.shopify-section, dialog');
        if (!closestSection) {
          this._updatingPrice = false;
          return;
        }

        const source = this.getActiveQuantityBreakSource(closestSection);
        if (!source) {
          this._updatingPrice = false;
          return;
        }

        const { type, activeElement } = source;
        const priceCents = this.getQuantityBreakPriceCents(source, activeElement);
        const compareCents = this.getQuantityBreakCompareCents(source, activeElement);
        const hasComparePrice = compareCents > priceCents;

        if (!priceCents) {
          this._updatingPrice = false;
          return;
        }

        const activeCard = activeElement;

        const currentPriceElement = this.querySelector('[ref="priceContainer"]');
        if (!currentPriceElement) {
          this._updatingPrice = false;
          return;
        }

        // Get show_sale_price_first setting
        const showSalePriceFirst = this.dataset.showSalePriceFirst === 'true';

        let currentPriceSpan = currentPriceElement.querySelector('.price');
        
        // Find ALL compare price elements to handle duplicates
        const allComparePriceSpans = this.querySelectorAll('.compare-at-price');
        
        if (currentPriceSpan) {
          if (!currentPriceSpan.closest('[role="group"]')) {
            const salePriceGroup = document.createElement('span');
            salePriceGroup.setAttribute('role', 'group');
            currentPriceSpan.parentNode.insertBefore(salePriceGroup, currentPriceSpan);
            salePriceGroup.appendChild(currentPriceSpan);
          }

          currentPriceSpan.innerHTML = ProductPrice.formatPriceSplitCents(priceCents);
          if (!hasComparePrice) {
            currentPriceSpan.style.marginLeft = '';
          }
        }

        if (hasComparePrice) {
          // Remove all existing compare price elements to prevent duplicates
          // This handles the case where multiple compare prices were created in previous calls
          // Also remove any groups that only contain compare prices
          allComparePriceSpans.forEach(compareSpan => {
            const comparePriceGroup = compareSpan.closest('[role="group"]');
            if (comparePriceGroup && comparePriceGroup.children.length === 1 && comparePriceGroup.querySelector('.compare-at-price')) {
              // Remove the entire group if it only contains the compare price
              comparePriceGroup.remove();
            } else {
              // Remove just the compare price span
              compareSpan.remove();
            }
          });

          // Now create a single compare price element
          const priceGroup = currentPriceSpan?.closest('[role="group"]') || currentPriceSpan?.parentElement;
          const comparePriceGroup = document.createElement('span');
          comparePriceGroup.setAttribute('role', 'group');
          const comparePriceSpan = document.createElement('span');
          comparePriceSpan.className = 'compare-at-price';
          comparePriceSpan.innerHTML = ProductPrice.formatPriceSplitCents(compareCents);
          
          // Set margin based on show_sale_price_first setting
          if (showSalePriceFirst) {
            comparePriceSpan.style.marginLeft = 'var(--margin-xs, 0.5rem)';
          } else {
            comparePriceSpan.style.marginLeft = '';
            if (currentPriceSpan) {
              currentPriceSpan.style.marginLeft = 'var(--margin-xs, 0.5rem)';
            }
          }
          comparePriceGroup.appendChild(comparePriceSpan);
          
          // Insert the compare price in the correct position
          if (currentPriceSpan && priceGroup) {
            // Respect show_sale_price_first setting for positioning
            if (showSalePriceFirst) {
              // Sale price first: price comes before compare price
              priceGroup.insertAdjacentElement('afterend', comparePriceGroup);
            } else {
              // Compare price first: compare price comes before price
              priceGroup.insertAdjacentElement('beforebegin', comparePriceGroup);
            }
          } else if (currentPriceSpan) {
            // Respect show_sale_price_first setting for positioning
            if (showSalePriceFirst) {
              currentPriceSpan.insertAdjacentElement('afterend', comparePriceGroup);
            } else {
              currentPriceSpan.insertAdjacentElement('beforebegin', comparePriceGroup);
            }
          } else {
            currentPriceElement.appendChild(comparePriceGroup);
          }
        } else {
          // If compare price doesn't exist in quantity breaks but exists in product price, remove all of them
          // Also remove any groups that only contain compare prices
          allComparePriceSpans.forEach(compareSpan => {
            const comparePriceGroup = compareSpan.closest('[role="group"]');
            if (comparePriceGroup && comparePriceGroup.children.length === 1 && comparePriceGroup.querySelector('.compare-at-price')) {
              // Remove the entire group if it only contains the compare price
              comparePriceGroup.remove();
            } else {
              // Remove just the compare price span
              compareSpan.remove();
            }
          });
          
          // Reset margin on price span when compare price is removed
          if (currentPriceSpan) {
            currentPriceSpan.style.marginLeft = '';
          }
        }

        this.updateSaleBadgeFromQuantityBreaks(activeCard, hasComparePrice ? currentPriceElement.querySelector('.compare-at-price') : null, type);
      } finally {
        // Reset flag after a short delay to allow DOM updates to complete
        setTimeout(() => {
          this._updatingPrice = false;
        }, 100);
      }
    });
  }

  /**
   * Handles variant:update events dispatched on document (e.g. quantity break variant pickers).
   * Section-bubbled events from variant-picker are handled by updatePrice instead.
   */
  handleDocumentVariantUpdate(event) {
    if (event.detail?.data?.html) return;

    const closestSection = this.closest('.shopify-section, dialog');
    if (!closestSection) return;

    if (!this.getActiveQuantityBreakSource(closestSection)) return;

    this.updatePriceFromQuantityBreaks();
  }

  /**
   * Updates the price and volume pricing note.
   * @param {VariantUpdateEvent} event - The variant update event.
   */
  updatePrice = (event) => {
    const eventData = event.detail?.data;

    if (eventData?.newProduct) {
      this.dataset.productId = eventData.newProduct.id;
    } else if (event.target instanceof HTMLElement && event.target.dataset?.productId && event.target.dataset.productId !== this.dataset.productId) {
      return;
    }

    // Check if quantity breaks block is present and has an active card
    // If so, use price from quantity breaks instead of variant price (only if override is enabled)
    // Only check within the same section
    const closestSection = this.closest('.shopify-section, dialog');
    if (closestSection && this.getActiveQuantityBreakSource(closestSection)) {
      this.updatePriceFromQuantityBreaks();
      return;
    }

    if (!eventData?.html) return;

    // Find the new product-price element in the updated HTML
    const newProductPrice = eventData.html.querySelector(`product-price[data-block-id="${this.dataset.blockId}"]`);
    if (!newProductPrice) return;

    // Update price container
    const newPrice = newProductPrice.querySelector('[ref="priceContainer"]');
    const currentPrice = this.querySelector('[ref="priceContainer"]');
    if (newPrice && currentPrice) currentPrice.replaceWith(newPrice);

    // Update volume pricing note
    const currentNote = this.querySelector('.volume-pricing-note');
    const newNote = newProductPrice.querySelector('.volume-pricing-note');

    if (!newNote) {
      currentNote?.remove();
    } else if (!currentNote) {
      this.querySelector('[ref="priceContainer"]')?.insertAdjacentElement('afterend', /** @type {Element} */ (newNote.cloneNode(true)));
    } else {
      currentNote.replaceWith(newNote);
    }
  };
}

if (!customElements.get('product-price')) {
  customElements.define('product-price', ProductPrice);
}
