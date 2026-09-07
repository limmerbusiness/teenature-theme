(function () {
  function resolveQuantityInput(container) {
    const scope =
      container.closest('[data-testid="product-information-details"]') ||
      container.closest('.product-information') ||
      container.closest('product-info') ||
      document;
    const visibleInput =
      scope.querySelector('quantity-selector-component input[name="quantity"]') ||
      scope.querySelector('.product-form__quantity .quantity__input[name="quantity"]') ||
      scope.querySelector('input[name="quantity"]');
    const tieredSelector = container.closest('.tiered-quantity-selector');
    const fallbackInput =
      tieredSelector && tieredSelector.querySelector('[data-tiered-quantity-fallback]');

    if (visibleInput) {
      if (fallbackInput) {
        fallbackInput.removeAttribute('name');
        fallbackInput.removeAttribute('form');
      }
      return visibleInput;
    }

    if (fallbackInput) {
      if (!fallbackInput.name) {
        fallbackInput.name = 'quantity';
        fallbackInput.setAttribute('form', fallbackInput.dataset.formId);
      }
      return fallbackInput;
    }

    return null;
  }

  function setQuantityValue(quantityInput, qty) {
    if (!quantityInput || Number.isNaN(qty)) return;
    quantityInput.value = qty;
    quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function formatTieredPrice(cents) {
    if (typeof Theme !== 'undefined' && Theme.formatPriceSplitHTML) {
      return Theme.formatPriceSplitHTML(cents, false, 'quantity_breaks');
    }
    const amount = Number(cents) / 100;
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      style: 'currency',
      currency: (typeof Theme !== 'undefined' && Theme.currency) || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function updateTieredOptionPrices(component, variant) {
    if (!component || !variant?.price) return;

    const basePrice = variant.price;
    const baseCompareAtPrice = variant.compare_at_price || variant.price;
    const discountType = component.dataset.discountType || 'percentage';
    const comparePriceType = component.dataset.comparePriceType || 'calculated';
    const showStrikethrough = component.dataset.showStrikethrough === 'true';
    const showTotalPricing = component.dataset.showTotalPricing === 'true';

    component.querySelectorAll('.tiered-option').forEach((button) => {
      const quantity = parseInt(button.getAttribute('data-quantity'), 10) || 1;
      const discountPercent = parseFloat(button.getAttribute('data-discount-percent') || '0') || 0;
      const fixedDiscountCents = parseInt(button.getAttribute('data-fixed-discount-cents') || '0', 10) || 0;

      const compareTotalCents = basePrice * quantity;
      const compareTotalCentsOriginal = baseCompareAtPrice * quantity;

      let finalPriceCents;
      if (discountType === 'price') {
        finalPriceCents = compareTotalCents - fixedDiscountCents;
      } else {
        finalPriceCents = Math.round((compareTotalCents * (100 - discountPercent)) / 100);
      }

      let shouldShowCompare = false;
      if (discountType === 'price') {
        if (fixedDiscountCents !== 0 && comparePriceType === 'calculated' && showStrikethrough) {
          shouldShowCompare = true;
        }
      } else if (discountPercent !== 0 && comparePriceType === 'calculated' && showStrikethrough) {
        shouldShowCompare = true;
      }

      let syncCompareCents = 0;
      if (shouldShowCompare && compareTotalCents > finalPriceCents) {
        syncCompareCents = compareTotalCents;
      }
      if (comparePriceType === 'original' && showStrikethrough && baseCompareAtPrice > basePrice && compareTotalCentsOriginal > finalPriceCents) {
        if (compareTotalCentsOriginal > syncCompareCents) {
          syncCompareCents = compareTotalCentsOriginal;
        }
        shouldShowCompare = true;
      }

      button.setAttribute('data-price-cents', String(finalPriceCents));
      if (shouldShowCompare && syncCompareCents > finalPriceCents) {
        button.setAttribute('data-compare-cents', String(syncCompareCents));
      } else {
        button.removeAttribute('data-compare-cents');
      }

      const finalPriceEl = button.querySelector('.tiered-option__final-price');
      if (finalPriceEl && showTotalPricing) {
        finalPriceEl.innerHTML = formatTieredPrice(finalPriceCents);
      }

      const comparePriceEls = button.querySelectorAll('.tiered-option__compare-price');
      if (shouldShowCompare && syncCompareCents > finalPriceCents) {
        const compareHtml = formatTieredPrice(syncCompareCents);
        if (comparePriceEls.length) {
          comparePriceEls.forEach((el, index) => {
            if (index === 0) {
              el.innerHTML = compareHtml;
              el.style.display = '';
            } else {
              el.remove();
            }
          });
        } else {
          const pricesContainer = button.querySelector('.tiered-option__prices, .tiered-option__compact-prices');
          if (pricesContainer) {
            const compareSpan = document.createElement('span');
            compareSpan.className = 'tiered-option__compare-price';
            compareSpan.innerHTML = compareHtml;
            const insertBefore = pricesContainer.querySelector('.tiered-option__final-price, .tiered-option__per-unit');
            if (insertBefore) {
              pricesContainer.insertBefore(compareSpan, insertBefore);
            } else {
              pricesContainer.prepend(compareSpan);
            }
          }
        }
      } else {
        comparePriceEls.forEach((el) => el.remove());
      }
    });
  }

  function handleTieredVariantUpdate(event) {
    const variant = event.detail?.resource;
    if (!variant?.price) return;

    document.querySelectorAll('[data-tiered-quantity-component]').forEach((component) => {
      updateTieredOptionPrices(component, variant);
    });

    syncTieredQuantityPrices(document.querySelector('[data-tiered-quantity-component]'));
  }

  function syncTieredQuantityPrices(container) {
    if (typeof window.updateQtyBreakSyncedPrices === 'function') {
      window.updateQtyBreakSyncedPrices();
    }
    if (typeof window.updateBuyButtonPriceFromQtyBreak === 'function') {
      const productEl =
        container?.closest('.product') || document.querySelector('.product');
      window.updateBuyButtonPriceFromQtyBreak(productEl);
    }
    if (typeof window.updateStickyAtcQuantityBadge === 'function') {
      window.updateStickyAtcQuantityBadge();
    }
  }

  function initializeTieredSelector(tieredSelector) {
    if (!tieredSelector || tieredSelector.dataset.tieredInitialized === 'true') return;

    const container = tieredSelector.querySelector('[data-tiered-quantity-block-id]');
    if (!container) return;

    const buttons = container.querySelectorAll('.tiered-option');
    if (!buttons.length) return;

    const quantityInput = resolveQuantityInput(container);
    const preselectedIndex = parseInt(container.dataset.preselected || '', 10) - 1;
    let activeButton = container.querySelector('.tiered-option--active');

    if (!activeButton && !Number.isNaN(preselectedIndex) && preselectedIndex >= 0 && preselectedIndex < buttons.length) {
      activeButton = buttons[preselectedIndex];
    }

    if (activeButton) {
      buttons.forEach((button) => button.classList.remove('tiered-option--active'));
      activeButton.classList.add('tiered-option--active');
      setQuantityValue(quantityInput, parseInt(activeButton.getAttribute('data-quantity'), 10));
      syncTieredQuantityPrices(container);
    }

    buttons.forEach((button) => {
      if (button.dataset.tieredOptionBound === 'true') return;
      button.dataset.tieredOptionBound = 'true';

      button.addEventListener('click', function () {
        const currentQuantityInput = resolveQuantityInput(container);

        buttons.forEach((item) => item.classList.remove('tiered-option--active'));
        this.classList.add('tiered-option--active');
        setQuantityValue(currentQuantityInput, parseInt(this.getAttribute('data-quantity'), 10));
        syncTieredQuantityPrices(container);
      });
    });

    tieredSelector.dataset.tieredInitialized = 'true';
  }

  function initializeAll(root) {
    const scope = root || document;
    scope.querySelectorAll('.tiered-quantity-selector').forEach(initializeTieredSelector);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeAll());
  } else {
    initializeAll();
  }

  document.addEventListener('shopify:section:load', (event) => initializeAll(event.target));
  document.addEventListener('shopify:block:select', (event) => initializeAll(event.target));
  document.addEventListener('variant:update', handleTieredVariantUpdate);

  window.updateQtyBreakSyncedPrices = function () {
    document.querySelectorAll('product-price').forEach((priceEl) => {
      if (typeof priceEl.updatePriceFromQuantityBreaks === 'function') {
        priceEl.updatePriceFromQuantityBreaks();
      }
    });
  };
})();
