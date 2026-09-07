/**
 * Quantity breaks – card selection, quantity sync, variant price/image updates.
 * Uses event delegation and defers init for faster load.
 */
(function() {
  const MAX_RETRIES = 3;

  function updateQuantity(quantity, variantId, retryCount = 0) {
    const qs = document.querySelector('quantity-selector-component');
    const input = qs?.refs?.quantityInput
      ? qs.refs.quantityInput
      : document.querySelector('input[name="quantity"]');
    if (input) {
      input.value = quantity;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    } else if (retryCount < MAX_RETRIES) {
      setTimeout(() => updateQuantity(quantity, variantId, retryCount + 1), 100);
      return;
    }

    const variantInput = document.querySelector('input[name="id"][ref="variantId"]');
    if (variantInput && variantId && variantInput.value !== String(variantId)) {
      variantInput.value = variantId;
      variantInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function formatPriceDisplay(cents, showCurrency = false, component = null) {
    if (typeof Theme !== 'undefined' && Theme.formatPriceSplitHTML) {
      return Theme.formatPriceSplitHTML(cents, showCurrency === true, 'quantity_breaks');
    }
    return formatMoney(cents, showCurrency, component);
  }

  function formatMoney(cents, showCurrency = false, component = null) {
    if (typeof window.Theme !== 'undefined' && typeof Theme.formatMoney === 'function') {
      let result = Theme.formatMoney(cents);
      if (showCurrency && Theme.currency && !result.includes(Theme.currency)) {
        result = `${result} ${Theme.currency}`.trim();
      }
      return result;
    }
    const amount = cents / 100;
    const currency = component?.dataset?.currency || (typeof window.Theme !== 'undefined' && window.Theme.currency) || 'USD';
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function updateFreeGiftsState(component) {
    const freeGifts = component.querySelector('[data-free-gifts]');
    if (!freeGifts) return;
    const activeCard = component.querySelector('.quantity-breaks__card--active');
    const selectedIndex = activeCard ? parseInt(activeCard.dataset.optionIndex || '1', 10) : 1;
    freeGifts.querySelectorAll('[data-gift-card]').forEach(giftCard => {
      const unlockIndex = parseInt(giftCard.dataset.unlockIndex || '2', 10);
      const enabled = selectedIndex >= unlockIndex;
      giftCard.classList.toggle('quantity-breaks-gift-card--enabled', enabled);
      giftCard.classList.toggle('quantity-breaks-gift-card--locked', !enabled);
      const variantSelect = giftCard.querySelector('[data-variant-select]');
      if (variantSelect) {
        variantSelect.disabled = !enabled;
      }
      if (enabled) {
        const opt = variantSelect?.options[variantSelect?.selectedIndex];
        if (opt) {
          giftCard.dataset.variantId = opt.value;
        }
      }
    });
  }

  function updateGiftCardPriceBadge(giftCard, priceCents) {
    const qb = document.querySelector('[data-quantity-breaks-component]');
    const discountEnabled = giftCard.dataset.giftDiscountEnabled === 'true';
    let displayPrice = priceCents;
    let originalPrice = priceCents;
    if (discountEnabled) {
      const discountType = giftCard.dataset.giftDiscountType || 'percentage';
      const discountValue = parseFloat(giftCard.dataset.giftDiscountValue) || 0;
      const discountAmount = parseFloat(giftCard.dataset.giftDiscountAmount) || 0;
      if (discountType === 'percentage') {
        displayPrice = Math.round(priceCents * (100 - discountValue) / 100);
      } else {
        displayPrice = Math.max(0, priceCents - discountAmount);
      }
    }
    const badge = giftCard.querySelector('.quantity-breaks-gift-card__price-badge');
    if (!badge || !qb) return;
    const fmt = (c) => formatPriceDisplay(c, false, qb);
    if (discountEnabled && displayPrice < originalPrice) {
      badge.innerHTML = '<span class="quantity-breaks-gift-card__original-price">' + fmt(originalPrice) + '</span><span class="quantity-breaks-gift-card__discounted-price">' + fmt(displayPrice) + '</span>';
    } else {
      badge.innerHTML = fmt(originalPrice);
    }
  }

  function initFreeGiftsVariantSelects(component) {
    const freeGifts = component.querySelector('[data-free-gifts]');
    if (!freeGifts) return;
    freeGifts.querySelectorAll('[data-variant-select]').forEach(select => {
      select.addEventListener('change', function() {
        const giftCard = this.closest('[data-gift-card]');
        if (giftCard && this.options[this.selectedIndex]) {
          const opt = this.options[this.selectedIndex];
          giftCard.dataset.variantId = opt.value;
          const price = parseInt(opt.dataset?.price || opt.getAttribute('data-price') || '0', 10);
          if (price) updateGiftCardPriceBadge(giftCard, price);
        }
      });
    });
  }

  function getVariantDataFromPickers(pickersContainer) {
    const el = pickersContainer?.querySelector('.quantity-breaks__variant-data');
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (_) {
      return null;
    }
  }

  function getRowSelectedOptionValues(row) {
    const selects = row.querySelectorAll('[data-variant-option-select]');
    return Array.from(selects)
      .sort((a, b) => parseInt(a.dataset.optionPosition || '0', 10) - parseInt(b.dataset.optionPosition || '0', 10))
      .map((sel) => sel.value);
  }

  function findVariantByOptions(variantData, selectedValues) {
    if (!variantData?.variants?.length || !selectedValues?.length) return null;
    return variantData.variants.find((v) => {
      if (v.option1 !== selectedValues[0]) return false;
      if (selectedValues.length > 1 && v.option2 !== selectedValues[1]) return false;
      if (selectedValues.length > 2 && v.option3 !== selectedValues[2]) return false;
      return true;
    }) || null;
  }

  function updateRowOptionAvailability(row, variantData) {
    const selects = Array.from(row.querySelectorAll('[data-variant-option-select]'))
      .sort((a, b) => parseInt(a.dataset.optionPosition || '0', 10) - parseInt(b.dataset.optionPosition || '0', 10));
    if (!selects.length || !variantData?.variants?.length) return;

    const selectedValues = selects.map((sel) => sel.value);
    selects.forEach((select, index) => {
      Array.from(select.options).forEach((opt) => {
        const testValues = selectedValues.slice();
        testValues[index] = opt.value;
        const match = findVariantByOptions(variantData, testValues);
        opt.disabled = !match || match.available === false;
      });
    });
  }

  function resolveRowVariant(row, pickersContainer) {
    const optionSelects = row.querySelectorAll('[data-variant-option-select]');
    if (!optionSelects.length) return null;

    const variantData = getVariantDataFromPickers(pickersContainer);
    if (!variantData) return null;

    updateRowOptionAvailability(row, variantData);
    let selectedValues = getRowSelectedOptionValues(row);
    let match = findVariantByOptions(variantData, selectedValues);

    if (!match || match.available === false) {
      match = variantData.variants.find((v) => v.available) || variantData.variants[0];
      if (match) {
        const selects = Array.from(optionSelects)
          .sort((a, b) => parseInt(a.dataset.optionPosition || '0', 10) - parseInt(b.dataset.optionPosition || '0', 10));
        selects.forEach((sel, idx) => {
          const val = idx === 0 ? match.option1 : idx === 1 ? match.option2 : match.option3;
          if (val && Array.from(sel.options).some((o) => o.value === val && !o.disabled)) {
            sel.value = val;
          }
        });
        selectedValues = getRowSelectedOptionValues(row);
        match = findVariantByOptions(variantData, selectedValues);
      }
    }

    if (match) {
      row.dataset.variantId = String(match.id);
    }
    return match;
  }

  function syncVariantPickersToCard(card) {
    if (!card?.dataset?.hasVariantPickers) return;
    const pickersContainer = card.querySelector('[data-quantity-breaks-variant-pickers]');
    if (!pickersContainer) return;

    const rows = pickersContainer.querySelectorAll('.quantity-breaks__variant-picker-row');
    const ids = [];

    rows.forEach((row) => {
      const optionSelects = row.querySelectorAll('[data-variant-option-select]');
      if (optionSelects.length) {
        const match = resolveRowVariant(row, pickersContainer);
        if (match?.id) ids.push(String(match.id));
        return;
      }

      const sel = row.querySelector('[data-variant-select]');
      if (sel?.options[sel.selectedIndex]) {
        ids.push(sel.options[sel.selectedIndex].value);
      }
    });

    if (ids.length) card.dataset.variantIds = ids.join(',');
  }

  function updateRowVariantSwatch(row, variantMatch) {
    const swatchEl = row?.querySelector('[data-variant-swatch]');
    if (!swatchEl) return;
    const swatchSelect = swatchEl.closest('.quantity-breaks__variant-picker-select-wrapper')?.querySelector('select');
    const opt = swatchSelect?.options[swatchSelect?.selectedIndex];
    const bg = opt?.dataset?.swatchBackground || opt?.getAttribute('data-swatch-background');
    if (bg) {
      swatchEl.style.setProperty('--swatch-background', bg);
      swatchEl.style.display = '';
    } else if (variantMatch?.image_url) {
      swatchEl.style.setProperty('--swatch-background', `url(${variantMatch.image_url})`);
      swatchEl.style.display = '';
    } else {
      swatchEl.style.display = 'none';
    }
  }

  function updateVariantSwatch(select, variantMatch) {
    const row = select.closest('.quantity-breaks__variant-picker-row');
    if (row?.querySelector('[data-variant-option-select]')) {
      updateRowVariantSwatch(row, variantMatch);
      return;
    }

    const wrapper = select.closest('.quantity-breaks__variant-picker-select-wrapper');
    const swatchEl = wrapper?.querySelector('[data-variant-swatch]');
    if (!swatchEl) return;
    const opt = select?.options[select?.selectedIndex];
    const bg = opt?.dataset?.swatchBackground || opt?.getAttribute('data-swatch-background');
    if (bg) {
      swatchEl.style.setProperty('--swatch-background', bg);
      swatchEl.style.display = '';
    } else {
      swatchEl.style.display = 'none';
    }
  }

  function resizeVariantSelectToContent(select) {
    const opt = select?.options[select?.selectedIndex];
    if (!opt) return;
    const text = opt.textContent.replace(/\s*-\s*Unavailable$/i, '').trim() || ' ';
    const cs = getComputedStyle(select);
    const measure = document.createElement('span');
    measure.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none;';
    measure.style.font = cs.font;
    measure.style.fontSize = cs.fontSize;
    measure.style.fontFamily = cs.fontFamily;
    measure.style.fontWeight = cs.fontWeight;
    measure.style.letterSpacing = cs.letterSpacing;
    measure.textContent = text;
    document.body.appendChild(measure);
    const textWidth = measure.offsetWidth;
    document.body.removeChild(measure);
    const padding = parseInt(cs.paddingLeft || 0, 10) + parseInt(cs.paddingRight || 0, 10);
    const arrowSpace = 28;
    select.style.width = Math.max(textWidth + padding + arrowSpace, 60) + 'px';
  }

  function buildVariantResource(match, variantId, price, compareAtPrice, imageUrl, mediaId) {
    const resolvedMediaId = mediaId || match?.media_id;
    const resolvedImageUrl = imageUrl || match?.image_url || null;
    const featuredMedia =
      resolvedMediaId || resolvedImageUrl
        ? {
            ...(resolvedMediaId ? { id: parseInt(resolvedMediaId, 10) } : {}),
            ...(resolvedImageUrl ? { preview_image: { src: resolvedImageUrl } } : {}),
          }
        : null;

    return {
      id: parseInt(variantId || match?.id, 10),
      price: price ?? match?.price,
      compare_at_price: compareAtPrice ?? (match?.compare_at_price || match?.price),
      featured_media: featuredMedia,
      featured_image: resolvedImageUrl,
    };
  }

  function getCardPrimaryVariantMatch(card) {
    const pickersContainer = card?.querySelector('[data-quantity-breaks-variant-pickers]');
    if (!pickersContainer) return null;

    const firstRow = pickersContainer.querySelector('.quantity-breaks__variant-picker-row');
    if (!firstRow) return null;

    const optionSelects = firstRow.querySelectorAll('[data-variant-option-select]');
    if (optionSelects.length) {
      return resolveRowVariant(firstRow, pickersContainer);
    }

    const sel = firstRow.querySelector('[data-variant-select]');
    const opt = sel?.options[sel?.selectedIndex];
    if (!opt) return null;

    return {
      id: opt.value,
      price: parseInt(opt.dataset?.price || opt.getAttribute('data-price') || '0', 10),
      compare_at_price: parseInt(opt.dataset?.compareAtPrice || opt.getAttribute('data-compare-at-price') || opt.dataset?.price || opt.getAttribute('data-price') || '0', 10),
      image_url: opt.dataset?.imageUrl || opt.getAttribute('data-image-url') || null,
      media_id: opt.dataset?.mediaId || opt.getAttribute('data-media-id') || null,
    };
  }

  let gallerySyncController = null;
  const SECTION_ID_PREFIX = 'shopify-section-';

  function normalizeSectionId(sectionId) {
    return sectionId?.replace(new RegExp(`^${SECTION_ID_PREFIX}`), '') || '';
  }

  function getProductSectionId(gallery) {
    const section = gallery?.closest('.shopify-section');
    return section ? normalizeSectionId(section.id) : null;
  }

  function getProductVariantFetchUrl(variantId) {
    const variantPicker = document.querySelector('variant-picker[data-template-product-match="true"]')
      || document.querySelector('variant-picker');
    const gallery = document.querySelector('media-gallery');
    const url = new URL(window.location.href);

    if (variantPicker?.dataset?.productUrl) {
      url.pathname = new URL(variantPicker.dataset.productUrl, window.location.origin).pathname;
    } else {
      const root = (typeof window.Shopify !== 'undefined' && window.Shopify.routes && window.Shopify.routes.root) || '/';
      const base = root.endsWith('/') ? root : `${root}/`;
      const handle = gallery?.dataset?.productHandle;

      if (handle) {
        url.pathname = `${base}products/${handle}`.replace(/\/{2,}/g, '/');
      } else {
        url.pathname = window.location.pathname.split('?')[0];
      }
    }

    url.searchParams.set('variant', String(variantId));

    const sectionId = getProductSectionId(gallery);
    if (sectionId) {
      url.searchParams.set('section_id', sectionId);
    }

    return url.toString();
  }

  function preserveGalleryPresentation(existingGallery, newGallery) {
    if (!existingGallery || !newGallery) return true;

    const existingPresentation = existingGallery.dataset.presentation;
    if (!existingPresentation || existingPresentation === newGallery.dataset.presentation) {
      return true;
    }

    if (existingPresentation === 'grid' && !newGallery.querySelector('.media-gallery__grid')) {
      return false;
    }

    newGallery.dataset.presentation = existingPresentation;
    newGallery.classList.remove('media-gallery--grid', 'media-gallery--carousel');
    newGallery.classList.add(`media-gallery--${existingPresentation}`);

    if (existingPresentation === 'grid') {
      const gridModifierPattern = /^media-gallery--(one|two)-column$|^media-gallery--large-first-image$/;
      for (const className of existingGallery.classList) {
        if (gridModifierPattern.test(className)) {
          newGallery.classList.add(className);
        }
      }
    }

    return true;
  }

  function replaceMainProductGallery(html) {
    const gallery = document.querySelector('media-gallery');
    const newGallery = html.querySelector('media-gallery');
    if (!gallery || !newGallery || !gallery.isConnected) return;
    if (!preserveGalleryPresentation(gallery, newGallery)) return;

    gallery.replaceWith(newGallery);
  }

  function syncMainProductGallery(match, overrides = {}) {
    const variantId = overrides.variantId || match?.id;
    if (!variantId) return;

    const gallery = document.querySelector('media-gallery');
    const isGridPresentation = gallery?.dataset?.presentation === 'grid';

    if (!isGridPresentation) {
      const variantPicker = document.querySelector('variant-picker[data-template-product-match="true"]')
        || document.querySelector('variant-picker');

      if (variantPicker && typeof variantPicker.fetchUpdatedSection === 'function' && variantPicker.dataset.productUrl) {
        variantPicker.fetchUpdatedSection(getProductVariantFetchUrl(variantId));
        return;
      }
    }

    gallerySyncController?.abort();
    gallerySyncController = new AbortController();

    fetch(getProductVariantFetchUrl(variantId), {
      signal: gallerySyncController.signal,
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Gallery sync failed (${response.status})`);
        return response.text();
      })
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        replaceMainProductGallery(html);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.warn('Quantity breaks: failed to sync product gallery', error);
        }
      });
  }

  function dispatchVariantUpdateFromMatch(match, overrides = {}) {
    if (!match && !overrides.variantId) return;

    const resource = buildVariantResource(
      match,
      overrides.variantId || match?.id,
      overrides.price ?? match?.price,
      overrides.compareAtPrice ?? match?.compare_at_price,
      overrides.imageUrl ?? match?.image_url,
      overrides.mediaId ?? match?.media_id
    );

    syncMainProductGallery(match, overrides);

    document.dispatchEvent(new CustomEvent('variant:update', {
      detail: { resource }
    }));
  }

  function handleVariantPickerChange(select) {
    const card = select.closest('.quantity-breaks__card');
    if (!card) return;

    const pickersContainer = select.closest('[data-quantity-breaks-variant-pickers]');
    const row = select.closest('.quantity-breaks__variant-picker-row');
    let variantId;
    let price;
    let compareAtPrice;
    let imageUrl;

    if (select.matches('[data-variant-option-select]') && row && pickersContainer) {
      const match = resolveRowVariant(row, pickersContainer);
      if (!match) return;
      variantId = String(match.id);
      price = match.price;
      compareAtPrice = match.compare_at_price || match.price;
      imageUrl = match.image_url || null;
      syncVariantPickersToCard(card);
      card.dataset.variantId = variantId;

      const isActive = card.classList.contains('quantity-breaks__card--active');
      if (isActive) {
        const quantity = parseInt(select.dataset.quantity || card.dataset.quantity || '2', 10);
        updateQuantity(quantity, variantId);
        dispatchVariantUpdateFromMatch(match);
      }

      resizeVariantSelectToContent(select);
      updateVariantSwatch(select, match);
      return;
    }

    if (!select.options[select.selectedIndex]) return;
    const opt = select.options[select.selectedIndex];
    variantId = opt.value;
    price = parseInt(opt.dataset?.price || opt.getAttribute('data-price') || '0', 10);
    compareAtPrice = parseInt(opt.dataset?.compareAtPrice || opt.getAttribute('data-compare-at-price') || price, 10);
    imageUrl = opt.dataset?.imageUrl || opt.getAttribute('data-image-url');
    const mediaId = opt.dataset?.mediaId || opt.getAttribute('data-media-id');

    syncVariantPickersToCard(card);
    card.dataset.variantId = variantId;

    const isActive = card.classList.contains('quantity-breaks__card--active');
    if (isActive) {
      const quantity = parseInt(select.dataset.quantity || card.dataset.quantity || '2', 10);
      updateQuantity(quantity, variantId);
      dispatchVariantUpdateFromMatch(null, {
        variantId,
        price,
        compareAtPrice,
        imageUrl,
        mediaId,
      });
    }

    resizeVariantSelectToContent(select);
    updateVariantSwatch(select);
  }

  function initQuantityBreaksVariantSelects(component) {
    component.querySelectorAll('[data-quantity-breaks-variant-pickers]').forEach((pickersContainer) => {
      pickersContainer.querySelectorAll('.quantity-breaks__variant-picker-row').forEach((row) => {
        if (row.querySelector('[data-variant-option-select]')) {
          resolveRowVariant(row, pickersContainer);
        }
      });
    });

    component.querySelectorAll('[data-quantity-breaks-variant-pickers] [data-variant-select], [data-quantity-breaks-variant-pickers] [data-variant-option-select]').forEach(select => {
      resizeVariantSelectToContent(select);
      if (select.matches('[data-variant-option-select]')) {
        const row = select.closest('.quantity-breaks__variant-picker-row');
        const pickersContainer = select.closest('[data-quantity-breaks-variant-pickers]');
        const match = row && pickersContainer ? resolveRowVariant(row, pickersContainer) : null;
        updateVariantSwatch(select, match);
      } else {
        updateVariantSwatch(select);
      }
      select.addEventListener('change', function() {
        handleVariantPickerChange(this);
      });
    });
  }

  function preselectRecommendedCard(component) {
    let recommended = component.querySelector('.quantity-breaks__card--recommended:not(.quantity-breaks__card--sold-out)');
    if (!recommended) {
      recommended = component.querySelector('.quantity-breaks__card:not(.quantity-breaks__card--sold-out)');
    }
    if (!recommended) return;
    syncVariantPickersToCard(recommended);
    const quantity = parseInt(recommended.dataset.quantity, 10);
    const variantId = recommended.dataset.variantId;
    updateQuantity(quantity, variantId);
    component.querySelectorAll('.quantity-breaks__card').forEach(c => {
      c.classList.remove('quantity-breaks__card--active');
    });
    recommended.classList.add('quantity-breaks__card--active');
    recommended.classList.remove('quantity-breaks__card--unselected');
    updateFreeGiftsState(component);
    const primaryVariant = getCardPrimaryVariantMatch(recommended);
    if (primaryVariant) {
      dispatchVariantUpdateFromMatch(primaryVariant);
    }
    recommended.querySelectorAll('[data-variant-select], [data-variant-option-select]').forEach(sel => {
      resizeVariantSelectToContent(sel);
      if (sel.matches('[data-variant-option-select]')) {
        const row = sel.closest('.quantity-breaks__variant-picker-row');
        const pickersContainer = sel.closest('[data-quantity-breaks-variant-pickers]');
        const match = row && pickersContainer ? resolveRowVariant(row, pickersContainer) : null;
        updateVariantSwatch(sel, match);
      } else {
        updateVariantSwatch(sel);
      }
    });
  }

  function getCardVariantTotal(card) {
    if (card?.dataset?.hasVariantPickers !== 'true') return null;
    const pickers = card.querySelector('[data-quantity-breaks-variant-pickers]');
    if (!pickers) return null;

    const variantData = getVariantDataFromPickers(pickers);
    const rows = pickers.querySelectorAll('.quantity-breaks__variant-picker-row');
    let totalPrice = 0;
    let totalCompare = 0;
    let count = 0;

    rows.forEach((row) => {
      if (row.querySelector('[data-variant-option-select]')) {
        const match = resolveRowVariant(row, pickers);
        if (match) {
          totalPrice += match.price || 0;
          totalCompare += match.compare_at_price || match.price || 0;
          count += 1;
        }
        return;
      }

      const sel = row.querySelector('[data-variant-select]');
      const opt = sel?.options[sel?.selectedIndex];
      if (opt) {
        totalPrice += parseInt(opt.dataset?.price || opt.getAttribute('data-price') || '0', 10);
        totalCompare += parseInt(opt.dataset?.compareAtPrice || opt.getAttribute('data-compare-at-price') || opt.dataset?.price || opt.getAttribute('data-price') || '0', 10);
        count += 1;
      }
    });

    return count > 0 ? { total: totalPrice, compare: totalCompare } : null;
  }

  function updateVariantPrices(event) {
    const component = document.querySelector('[data-quantity-breaks-component]');
    if (!component) return;
    const variant = event.detail?.resource;
    if (!variant?.price) return;

    const basePrice = variant.price;
    const baseCompareAtPrice = variant.compare_at_price || variant.price;
    const variantId = variant.id;
    const showCurrency = component.dataset.currencyCodeEnabled === 'true';
    const perUnitText = component.dataset.perUnitText || '/Pcs';
    const comparePriceType = component.dataset.comparePriceType || 'calculated';
    const cards = component.querySelectorAll('.quantity-breaks__card');

    cards.forEach(card => {
      const pickerTotal = getCardVariantTotal(card);
      if (pickerTotal) {
        syncVariantPickersToCard(card);
      }
      const firstRow = card.querySelector('.quantity-breaks__variant-picker-row');
      let cardVariantId = variantId;
      if (firstRow) {
        if (firstRow.dataset.variantId) {
          cardVariantId = firstRow.dataset.variantId;
        } else {
          const firstPickerSelect = firstRow.querySelector('[data-variant-select]');
          cardVariantId = firstPickerSelect?.options[firstPickerSelect?.selectedIndex]?.value || variantId;
        }
      }
      if (cardVariantId) card.dataset.variantId = cardVariantId;

      const quantity = parseInt(card.dataset.quantity, 10) || 1;
      const discountType = card.dataset.discountType || 'percentage';
      const discount = parseFloat(card.dataset.discount) || 0;
      const discountAmountFixed = parseFloat(card.dataset.discountAmount) || 0;
      const showPerUnit = card.dataset.showPerUnit === 'true';

      let total;
      let baseCompareForCompare;
      if (pickerTotal) {
        total = pickerTotal.total;
        baseCompareForCompare = pickerTotal.compare;
      } else {
        total = basePrice * quantity;
        baseCompareForCompare = baseCompareAtPrice * quantity;
      }
      const discountAmount = discountType === 'fixed' ? discountAmountFixed : total * discount / 100;
      const discountAmountFloored = discountType === 'fixed' ? discountAmountFixed : Math.floor(discountAmount);
      let finalPrice = total - discountAmountFloored;
      if (discountType !== 'fixed' && discountAmount % 1 > 0) {
        finalPrice += 1;
      }
      const effectiveDiscount = total > 0 ? Math.round((discountAmount / total) * 100) : 0;
      const discountAmountRounded = discountType === 'fixed' ? discountAmountFixed : Math.round(discountAmount);
      const comparePrice = comparePriceType === 'original' ? baseCompareForCompare : total;
      const finalPriceRounded = Math.round(finalPrice);
      const comparePriceRounded = Math.round(comparePrice);
      const shouldShowCompare = comparePriceType === 'original'
        ? effectiveDiscount > 0
          || (discountType === 'fixed' && discountAmountRounded > 0)
          || baseCompareForCompare > finalPriceRounded
        : effectiveDiscount > 0
          || (discountType === 'fixed' && discountAmountRounded > 0)
          || comparePriceRounded > finalPriceRounded;

      card.dataset.finalPriceCents = String(finalPriceRounded);
      card.dataset.comparePriceCents = String(comparePriceRounded);

      const priceContainer = card.querySelector('.quantity-breaks__price-container');
      if (!priceContainer) return;
      const finalFormatted = formatPriceDisplay(finalPriceRounded, showCurrency, component);
      const compareFormatted = formatPriceDisplay(comparePriceRounded, showCurrency, component);

      if (showPerUnit) {
        const perUnitPrice = Math.round(finalPriceRounded / quantity);
        let perUnitCompare = Math.round(comparePriceRounded / quantity);
        if (comparePriceType === 'original' && baseCompareForCompare > finalPriceRounded) {
          perUnitCompare = Math.round(baseCompareForCompare / quantity);
        }
        const priceEl = priceContainer.querySelector('.quantity-breaks__price');
        const compareEl = priceContainer.querySelector('.quantity-breaks__original-price');
        if (priceEl) {
          priceEl.innerHTML = formatPriceDisplay(perUnitPrice, showCurrency, component) + ' <span class="quantity-breaks__per-unit-text">' + perUnitText + '</span>';
        }
        if (shouldShowCompare) {
          const html = formatPriceDisplay(perUnitCompare, showCurrency, component) + ' <span class="quantity-breaks__per-unit-text">' + perUnitText + '</span>';
          if (compareEl) {
            compareEl.innerHTML = html;
            compareEl.style.display = '';
          } else if (priceEl) {
            const span = document.createElement('span');
            span.className = 'quantity-breaks__original-price';
            span.innerHTML = html;
            priceContainer.appendChild(span);
          }
        } else if (compareEl) compareEl.remove();
      } else {
        const priceEl = priceContainer.querySelector('.quantity-breaks__price');
        const compareEl = priceContainer.querySelector('.quantity-breaks__original-price');
        if (priceEl) priceEl.innerHTML = finalFormatted;
        if (shouldShowCompare) {
          if (compareEl) {
            compareEl.innerHTML = compareFormatted;
            compareEl.style.display = '';
          } else if (priceEl) {
            const span = document.createElement('span');
            span.className = 'quantity-breaks__original-price';
            span.innerHTML = compareFormatted;
            priceContainer.appendChild(span);
          }
        } else if (compareEl) compareEl.remove();
      }
    });
  }

  function updateVariantImages(event) {
    const component = document.querySelector('[data-quantity-breaks-component]');
    if (!component) return;
    const variant = event.detail?.resource;
    if (!variant) return;

    let url = variant.featured_media?.preview_image?.src || variant.featured_image;
    if (!url && event.detail?.data?.html) {
      const el = event.detail.data.html.querySelector('[data-product-variant-media]');
      if (el) url = (el.getAttribute('data-product-variant-media') || '').split('&width=')[0].split('?width=')[0];
    }
    if (!url) return;

    const imageSize = parseInt(getComputedStyle(component).getPropertyValue('--image-size') || '60', 10) * 2;
    component.querySelectorAll('img[data-option-image]').forEach(img => {
      if (img.dataset.customImage === 'true') return;
      try {
        const u = new URL(url, window.location.origin);
        u.searchParams.set('width', String(imageSize));
        img.src = u.toString();
      } catch (_) {
        img.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'width=' + imageSize;
      }
    });
  }

  function handleVariantUpdate(event) {
    updateVariantImages(event);
    updateVariantPrices(event);
  }

  function initQuantityBreaks(componentEl) {
    const component = componentEl || document.querySelector('[data-quantity-breaks-component]');
    if (!component) return;

    if (!component.dataset.initialized) {
      component.dataset.initialized = '1';
      // Event delegation: one listener on container instead of per card
      component.addEventListener('click', function(e) {
        const card = e.target.closest('.quantity-breaks__card');
        if (!card || card.classList.contains('quantity-breaks__card--sold-out')) return;
        if (!card.classList.contains('quantity-breaks__card--recommended')) {
          component.dataset.userHasSelectedOther = 'true';
        }
        syncVariantPickersToCard(card);
        const quantity = parseInt(card.dataset.quantity, 10);
        const variantId = card.dataset.variantId;
        updateQuantity(quantity, variantId);
        component.querySelectorAll('.quantity-breaks__card').forEach(c => {
          c.classList.remove('quantity-breaks__card--active');
          if (c !== card && c.classList.contains('quantity-breaks__card--recommended')) {
            c.classList.add('quantity-breaks__card--unselected');
          }
        });
        card.classList.add('quantity-breaks__card--active');
        card.classList.remove('quantity-breaks__card--unselected');
        updateFreeGiftsState(component);
        const primaryVariant = getCardPrimaryVariantMatch(card);
        if (primaryVariant) {
          dispatchVariantUpdateFromMatch(primaryVariant);
        }
        card.querySelectorAll('[data-variant-select], [data-variant-option-select]').forEach(sel => {
          resizeVariantSelectToContent(sel);
          if (sel.matches('[data-variant-option-select]')) {
            const row = sel.closest('.quantity-breaks__variant-picker-row');
            const pickersContainer = sel.closest('[data-quantity-breaks-variant-pickers]');
            const match = row && pickersContainer ? resolveRowVariant(row, pickersContainer) : null;
            updateVariantSwatch(sel, match);
          } else {
            updateVariantSwatch(sel);
          }
        });
        const buy = document.querySelector('.buy-buttons-block');
        if (buy) setTimeout(() => buy.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
      });
    }

    initFreeGiftsVariantSelects(component);
    initQuantityBreaksVariantSelects(component);
    setTimeout(() => {
      preselectRecommendedCard(component);
      if (!component.querySelector('.quantity-breaks__card--recommended')) {
        updateFreeGiftsState(component);
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initQuantityBreaks());
  } else {
    initQuantityBreaks();
  }

  document.addEventListener('variant:update', handleVariantUpdate);
  document.addEventListener('shopify:section:load', function(ev) {
    const comp = ev.detail?.querySelector?.('[data-quantity-breaks-component]');
    if (comp) {
      delete comp.dataset.initialized;
      initQuantityBreaks(comp);
    }
  });
})();
