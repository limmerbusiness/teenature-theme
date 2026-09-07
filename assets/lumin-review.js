/**
 * Lumin Review Section
 * Config is read from [data-lumin-review-config] JSON script adjacent to each section root.
 */
(function () {
  'use strict';

  function parseConfig(section) {
    const script = section.querySelector('[data-lumin-review-config]');
    if (!script) return {};
    try {
      return JSON.parse(script.textContent.trim());
    } catch (e) {
      return {};
    }
  }

  function getStarPath() {
    return 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
  }

  function generateStars(rating, config) {
    const spriteId = config.starSpriteId || '';
    const halfId = config.starHalfGradientId || '';
    let html = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const useSprite = spriteId && document.getElementById(spriteId);

    if (useSprite) {
      for (let i = 0; i < fullStars; i++) {
        html += `<svg class="lr-star lr-star--full" viewBox="0 0 24 24" aria-hidden="true"><use href="#${spriteId}"></use></svg>`;
      }
      if (hasHalfStar) {
        html += `<svg class="lr-star lr-star--half" viewBox="0 0 24 24" aria-hidden="true"><use href="#${spriteId}" fill="url(#${halfId})"></use></svg>`;
      }
      const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
      for (let i = 0; i < emptyStars; i++) {
        html += `<svg class="lr-star lr-star--empty" viewBox="0 0 24 24" aria-hidden="true"><use href="#${spriteId}"></use></svg>`;
      }
      return html;
    }

    const path = getStarPath();
    for (let i = 0; i < fullStars; i++) {
      html += `<svg class="lr-star lr-star--full" viewBox="0 0 24 24" fill="${config.featureColor}"><path d="${path}"/></svg>`;
    }
    if (hasHalfStar) {
      html += `<svg class="lr-star lr-star--half" viewBox="0 0 24 24"><defs><linearGradient id="popup-half-star"><stop offset="50%" stop-color="${config.featureColor}"/><stop offset="50%" stop-color="${config.inactiveColor}"/></linearGradient></defs><path fill="url(#popup-half-star)" d="${path}"/></svg>`;
    }
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      html += `<svg class="lr-star lr-star--empty" viewBox="0 0 24 24" fill="${config.inactiveColor}"><path d="${path}"/></svg>`;
    }
    return html;
  }

  function hasMultiColumnLayout(config) {
    return (
      config.hasMultiColumn ||
      Math.max(config.maxColumnsDesk || 1, config.maxColumnsTab || 1, config.maxColumnsMobile || 1) > 1
    );
  }

  function shouldShowLoadPreview(config) {
    return hasMultiColumnLayout(config) && config.showLoadMoreFade !== false;
  }

  function animateLoadedReviews(items) {
    if (!items.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    items.forEach((item, index) => {
      item.classList.add('rw-container-contant--enter');
      item.style.setProperty('--lr-enter-delay', `${index * 55}ms`);
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        items.forEach((item) => item.classList.add('is-enter-visible'));
      });
    });
  }

  function getMaxColumnsSetting(config) {
    const width = window.innerWidth;
    if (width <= 600) return config.maxColumnsMobile || 2;
    if (width <= 900) return config.maxColumnsTab || 2;
    return config.maxColumnsDesk || 7;
  }

  function normalizeBlockId(id) {
    if (!id) return '';
    const value = String(id);
    if (value.includes('__')) {
      return value.split('__').pop();
    }
    return value;
  }

  function getBlockOrder(section) {
    const script = section.querySelector('[data-lumin-review-block-order]');
    if (script) {
      try {
        const parsed = JSON.parse(script.textContent.trim());
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch (e) {
        /* fall through */
      }
    }

    const config = parseConfig(section);
    return Array.isArray(config.reviewBlockOrder) ? config.reviewBlockOrder : [];
  }

  function getBlockId(item) {
    if (item.dataset.blockId) return item.dataset.blockId;
    if (item.dataset.blockIdShort) return item.dataset.blockIdShort;

    const editorAttr = item.getAttribute('data-shopify-editor-block');
    if (editorAttr) {
      try {
        const parsed = JSON.parse(editorAttr);
        if (parsed?.id) return parsed.id;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  function getBlockIdCandidates(item, sectionId) {
    const rawIds = [
      item.dataset.blockId,
      item.dataset.blockIdShort,
      getBlockId(item),
    ].filter(Boolean);

    const candidates = new Set();
    rawIds.forEach((id) => {
      candidates.add(id);
      candidates.add(normalizeBlockId(id));
      if (sectionId && !String(id).startsWith(`${sectionId}__`)) {
        candidates.add(`${sectionId}__${id}`);
        candidates.add(`${sectionId}__${normalizeBlockId(id)}`);
      }
    });

    return [...candidates];
  }

  function isDesignMode() {
    return Boolean(window.Shopify && window.Shopify.designMode);
  }

  function getReviewSortPosition(item, blockOrder, sectionId) {
    if (isDesignMode()) {
      const reviewIndex = parseInt(item.dataset.reviewIndex, 10);
      if (reviewIndex > 0) return reviewIndex - 1;
    }

    return resolveReviewPosition(item, blockOrder, sectionId);
  }

  function resolveReviewPosition(item, blockOrder, sectionId) {
    if (blockOrder.length) {
      const candidates = getBlockIdCandidates(item, sectionId);
      for (const id of candidates) {
        const pos = blockOrder.indexOf(id);
        if (pos !== -1) return pos;
      }

      const shortId = item.dataset.blockIdShort || normalizeBlockId(item.dataset.blockId);
      if (shortId) {
        const pos = blockOrder.findIndex(
          (key) => key === shortId || key.endsWith(`__${shortId}`) || normalizeBlockId(key) === shortId
        );
        if (pos !== -1) return pos;
      }
    }

    const reviewIndex = parseInt(item.dataset.reviewIndex, 10);
    if (reviewIndex > 0) return reviewIndex - 1;

    return Number.MAX_SAFE_INTEGER;
  }

  function syncReviewOrderData(section) {
    if (isDesignMode()) return;

    const list = section.querySelector('[data-lumin-review-list]');
    if (!list) return;

    const sectionId = section.dataset.sectionId || list.dataset.luminSectionId || '';
    const blockOrder = getBlockOrder(section);

    list.querySelectorAll('.rw-container-contant:not(.rw-container-contant--preview)').forEach((item) => {
      const pos = getReviewSortPosition(item, blockOrder, sectionId);
      if (pos !== Number.MAX_SAFE_INTEGER) {
        item.dataset.reviewIndex = String(pos + 1);
      }
    });
  }

  function getReviewItems(list) {
    const section = list.closest('[data-lumin-review]');
    if (!section) return [];

    const sectionId = section.dataset.sectionId || list.dataset.luminSectionId || '';
    const blockOrder = getBlockOrder(section);

    const items = Array.from(
      list.querySelectorAll('.rw-container-contant:not(.rw-container-contant--preview)')
    ).filter((item) => {
      const itemSectionId = item.dataset.luminSectionId;
      return !sectionId || !itemSectionId || itemSectionId === sectionId;
    });

    return items.sort((a, b) => {
      const aPos = getReviewSortPosition(a, blockOrder, sectionId);
      const bPos = getReviewSortPosition(b, blockOrder, sectionId);
      if (aPos !== bPos) return aPos - bPos;
      return items.indexOf(a) - items.indexOf(b);
    });
  }

  function removePreviewItems(list) {
    list.querySelectorAll('.rw-container-contant--preview').forEach((item) => item.remove());
  }

  function getVisibleReviewItemsInDomOrder(list) {
    const items = [];

    list.querySelectorAll(':scope > .rw-masonry-column').forEach((column) => {
      column.querySelectorAll(':scope > .rw-container-contant:not(.rw-container-contant--preview)').forEach((item) => {
        items.push(item);
      });
    });

    list.querySelectorAll(':scope > .rw-container-contant:not(.rw-container-contant--preview)').forEach((item) => {
      if (!items.includes(item)) items.push(item);
    });

    return items;
  }

  function reviewLayoutNeedsUpdate(list, items, columns) {
    const domOrder = getVisibleReviewItemsInDomOrder(list);
    const sameOrder =
      items.length === domOrder.length && items.every((item, index) => item === domOrder[index]);
    const currentColumns = list.querySelectorAll(':scope > .rw-masonry-column').length;

    return !sameOrder || currentColumns !== columns;
  }

  function refreshReviewLayout(section, config) {
    syncReviewOrderData(section);
    layoutReviewMasonry(section, config);
    if (typeof section._lrUpdateFade === 'function') {
      section._lrUpdateFade();
    }
  }

  function layoutMasonryColumns(container, items, columns) {
    container.querySelectorAll(':scope > .rw-masonry-column').forEach((column) => column.remove());
    items.forEach((item) => item.remove());

    const columnCount = Math.max(1, columns);
    const columnEls = [];

    for (let i = 0; i < columnCount; i++) {
      const column = document.createElement('div');
      column.className = 'rw-masonry-column';
      columnEls.push(column);
      container.appendChild(column);
    }

    // Row-major assignment keeps canonical order: 1-5 across the first row, 6-10 across the second, etc.
    items.forEach((item, index) => {
      columnEls[index % columnCount].appendChild(item);
    });

    return columnEls;
  }

  function layoutReviewMasonry(section, config) {
    const list = section.querySelector('[data-lumin-review-list]');
    if (!list) return;

    removePreviewItems(list);

    const items = getReviewItems(list);
    if (!items.length) {
      list.classList.remove('rw-container--flat');
      return;
    }

    const maxSetting = getMaxColumnsSetting(config);
    const columns = Math.min(items.length, maxSetting);

    if (!reviewLayoutNeedsUpdate(list, items, columns)) {
      section.style.setProperty('--lr-columns-active', String(columns));
      list.classList.remove('rw-container--flat');
      return;
    }

    layoutMasonryColumns(list, items, columns);
    section.style.setProperty('--lr-columns-active', String(columns));
    list.classList.remove('rw-container--flat');
  }

  function bindThemeEditorReviewSync(section, config) {
    if (!isDesignMode() || section._lrEditorSyncBound) return;
    section._lrEditorSyncBound = true;

    let refreshTimer;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (section._lrLayoutRefreshing) return;
        section._lrLayoutRefreshing = true;
        try {
          refreshReviewLayout(section, config);
          syncGalleryFromReviews(section);
        } finally {
          section._lrLayoutRefreshing = false;
        }
      }, 200);
    };

    const handleSectionEvent = (event) => {
      const targetSection = event.target.closest?.('.shopify-section') || event.target;
      if (!targetSection || !targetSection.contains(section)) return;
      scheduleRefresh();
    };

    document.addEventListener('shopify:section:reorder', handleSectionEvent);
  }

  function bindReviewColumnResize(section, config) {
    if (section._lrColumnResizeBound) return;
    section._lrColumnResizeBound = true;

    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => refreshReviewLayout(section, config), 100);
    };

    window.addEventListener('resize', onResize);
  }

  function prepareDeferredReviews(list, deferredStore, perPage) {
    if (!list || !deferredStore || !perPage) return;

    const items = getReviewItems(list);
    if (items.length <= perPage) return;

    items.slice(perPage).forEach((item) => {
      const template = document.createElement('template');
      template.content.appendChild(item);
      deferredStore.appendChild(template);
    });
  }

  function initLoadMore(section, config) {
    const list = section.querySelector('[data-lumin-review-list]');
    const deferredStore = section.querySelector('[data-lumin-review-deferred]');
    const loadMoreBtn = section.querySelector('[data-lumin-review-load-more]');
    if (!list || !loadMoreBtn) return;

    const perPage = config.reviewLoad || 6;
    prepareDeferredReviews(list, deferredStore, perPage);
    const fadeEl = section.querySelector('[data-lumin-review-fade]');
    const showPreview = shouldShowLoadPreview(config);

    function getRemainingTemplates() {
      return deferredStore ? Array.from(deferredStore.querySelectorAll('template')) : [];
    }

    function updateFade() {
      const remaining = getRemainingTemplates();
      const hasMore = remaining.length > 0;

      if (fadeEl) {
        fadeEl.classList.toggle('is-hidden', !hasMore || !showPreview);
      }

      if (!showPreview || !hasMore) {
        removePreviewItems(list);
        section._lrPreviewSignature = '';
        return;
      }

      const columns =
        parseInt(section.style.getPropertyValue('--lr-columns-active'), 10) || getMaxColumnsSetting(config);
      const columnEls = list.querySelectorAll(':scope > .rw-masonry-column');
      if (!columnEls.length) return;

      const visibleCount = getReviewItems(list).length;
      const previewCount = Math.min(remaining.length, columns);
      const previewIndices = remaining.slice(0, previewCount).map((template, index) => {
        const node = template.content.firstElementChild;
        return node?.dataset?.reviewIndex || String(visibleCount + index + 1);
      });
      const signature = `fade:${columns}:${visibleCount}:${previewIndices.join(',')}`;

      if (section._lrPreviewSignature === signature && list.querySelector('.rw-container-contant--preview')) {
        return;
      }

      section._lrPreviewSignature = signature;
      removePreviewItems(list);

      remaining.slice(0, previewCount).forEach((template, index) => {
        const node = template.content.firstElementChild;
        if (!node) return;

        const clone = node.cloneNode(true);
        clone.classList.add('rw-container-contant--preview', 'rw-container-contant--preview-fade');
        clone.setAttribute('aria-hidden', 'true');
        columnEls[(visibleCount + index) % columns].appendChild(clone);
      });
    }

    section._lrUpdateFade = updateFade;

    function updateButton() {
      if (!deferredStore || getRemainingTemplates().length === 0) {
        loadMoreBtn.classList.add('is-hidden');
      } else {
        loadMoreBtn.classList.remove('is-hidden');
      }
    }

    function loadMore() {
      if (!deferredStore) return;
      const remaining = getRemainingTemplates();
      let loaded = 0;
      const loadedNodes = [];

      list.classList.add('rw-container--flat');

      for (const template of remaining) {
        if (loaded >= perPage) break;
        const node = template.content.firstElementChild;
        if (node) {
          loadedNodes.push(node);
          list.appendChild(node);
          template.remove();
          loaded++;
        }
      }

      const loadedIndices = new Set(loadedNodes.map((node) => node.dataset.reviewIndex));

      updateButton();
      layoutReviewMasonry(section, config);

      const animatedItems = getReviewItems(list).filter((item) => loadedIndices.has(item.dataset.reviewIndex));
      animateLoadedReviews(animatedItems);

      if (typeof section._lrUpdateFade === 'function') {
        section._lrUpdateFade();
      }

      if (config.enablePopup) bindPopupItems(section, config);
      syncGalleryFromReviews(section);
    }

    loadMoreBtn.addEventListener('click', loadMore);
    updateButton();
  }

  function initNumberedPagination(section, config) {
    const list = section.querySelector('[data-lumin-review-list]');
    const deferredStore = section.querySelector('[data-lumin-review-deferred]');
    const pagination = section.querySelector('[data-lumin-review-pagination]');
    if (!list || !pagination) return;

    const perPage = config.reviewLoad || 6;
    const totalReviews = config.totalReviews || 0;
    prepareDeferredReviews(list, deferredStore, perPage);
    const page1Items = getReviewItems(list).map((el) => el.cloneNode(true));
    const templates = deferredStore ? Array.from(deferredStore.querySelectorAll('template')) : [];
    let currentPage = 1;

    function getReviewNode(globalIndex) {
      if (globalIndex < page1Items.length) {
        return page1Items[globalIndex].cloneNode(true);
      }

      const template = templates[globalIndex - page1Items.length];
      const node = template?.content?.firstElementChild;
      return node ? node.cloneNode(true) : null;
    }

    function showPage(page) {
      const start = (page - 1) * perPage;
      const end = Math.min(start + perPage, totalReviews);

      list.classList.add('rw-container--flat');
      list.replaceChildren();
      for (let i = start; i < end; i++) {
        const node = getReviewNode(i);
        if (node) list.appendChild(node);
      }

      pagination.querySelectorAll('[data-page]').forEach((btn) => {
        const pageNum = parseInt(btn.dataset.page, 10);
        const isActive = pageNum === page;
        btn.classList.toggle('is-active', isActive);
        btn.toggleAttribute('aria-current', isActive);
      });

      currentPage = page;

      layoutReviewMasonry(section, config);
      if (typeof section._lrUpdateFade === 'function') {
        section._lrUpdateFade();
      }
      if (config.enablePopup) bindPopupItems(section, config);
      initCustomerAvatarFallback(section);

      const container = list.closest('.load-more-container');
      if (container && page !== 1) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    pagination.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn) return;

      const page = parseInt(btn.dataset.page, 10);
      if (!page || page === currentPage) return;
      showPage(page);
    });
  }

  function initPagination(section, config) {
    const list = section.querySelector('[data-lumin-review-list]');
    const domCount = list ? getReviewItems(list).length : 0;
    const perPage = config.reviewLoad || 6;

    if (domCount > 0 && (!config.totalReviews || config.totalReviews < domCount)) {
      config.totalReviews = domCount;
      config.totalPages = Math.max(1, Math.ceil(domCount / perPage));
    }

    if (config.paginationStyle === 'numbered') {
      initNumberedPagination(section, config);
      return;
    }

    initLoadMore(section, config);
  }

  const ENLARGE_MAX_WIDTH = 3840;

  function isShopifyCdnUrl(src) {
    return /cdn\.shopify\.com|\/cdn\/shop\//i.test(src);
  }

  function getCleanShopifyImageUrl(src) {
    try {
      const url = new URL(src, window.location.href);
      url.search = '';
      return url.toString();
    } catch (e) {
      return src.split('?')[0];
    }
  }

  function withShopifyImageWidth(src, width) {
    const clean = getCleanShopifyImageUrl(src);
    if (!width) return clean;

    try {
      const url = new URL(clean, window.location.href);
      url.searchParams.set('width', String(width));
      return url.toString();
    } catch (e) {
      const joiner = clean.includes('?') ? '&' : '?';
      return `${clean}${joiner}width=${width}`;
    }
  }

  function buildShopifyImageUrls(src, displayWidth, fullWidth) {
    if (!isShopifyCdnUrl(src)) {
      return { display: src, full: src };
    }

    return {
      display: withShopifyImageWidth(src, displayWidth),
      full: withShopifyImageWidth(src, fullWidth || ENLARGE_MAX_WIDTH),
    };
  }

  function getEnlargeImageSrc(src) {
    if (!src) return src;
    if (isShopifyCdnUrl(src)) {
      return withShopifyImageWidth(src, ENLARGE_MAX_WIDTH);
    }
    return src;
  }

  function extractReviewData(reviewBlock) {
    const section = reviewBlock.closest('[data-lumin-review]');
    const popupQuality = configPopupQuality(section);
    const rating = parseFloat(reviewBlock.dataset.rating) || 5;
    const nameEl = reviewBlock.querySelector('.rw-text-name');
    const dateEl = reviewBlock.querySelector('.rw-date');
    const titleEl = reviewBlock.querySelector('.rw-text-head');
    const textEl = reviewBlock.querySelector('.rw-text-main');
    const imageEls = reviewBlock.querySelectorAll('.main-review .review-image');
    const customerAvatar = reviewBlock.querySelector('.customer-avatar img.customer-avatar-img');
    const visibleInitials = reviewBlock.querySelector('.customer-initials--visible');
    const countryFlag = reviewBlock.querySelector('.country-flag[data-flag-url]');
    const productTitle = reviewBlock.querySelector('.lm-text-clip');
    const productImage = reviewBlock.querySelector('.review-product-thumb');

    let customerImage = reviewBlock.dataset.customerImage || null;
    if (!customerImage && customerAvatar && customerAvatar.src && !visibleInitials) {
      customerImage = customerAvatar.currentSrc || customerAvatar.src;
    }

    const data = {
      name: nameEl ? nameEl.textContent.trim() : 'Anonymous',
      date: dateEl ? dateEl.textContent.trim() : '',
      title: titleEl ? titleEl.textContent.trim() : 'Review',
      text: textEl ? textEl.textContent.trim() : '',
      rating: rating,
      images: [],
      product: null,
      customerImage: customerImage,
      customerInitials: !customerImage && visibleInitials ? visibleInitials.textContent.trim() : null,
      countryFlagUrl: countryFlag ? countryFlag.dataset.flagUrl : null,
      likeSize: reviewBlock.dataset.likeSize || '0',
      dislikeSize: reviewBlock.dataset.dislikeSize || '0',
    };

    imageEls.forEach((img) => {
      if (!img.src) return;
      const src = img.currentSrc || img.src;
      const urls = buildShopifyImageUrls(src, popupQuality, ENLARGE_MAX_WIDTH);
      if (img.dataset.fullSrc) {
        urls.full = img.dataset.fullSrc;
      }
      data.images.push(urls);
    });

    if (productTitle || productImage) {
      data.product = {
        title: productTitle ? productTitle.textContent.trim() : 'Product',
        image: productImage ? productImage.currentSrc || productImage.src : null,
      };
    }

    return data;
  }

  function configPopupQuality(section) {
    if (!section) return 800;
    const script = section.querySelector('[data-lumin-review-config]');
    if (!script) return 800;
    try {
      const cfg = JSON.parse(script.textContent);
      return parseInt(cfg.popupImageQuality, 10) || 800;
    } catch (e) {
      return 800;
    }
  }

  function initPopup(section, config) {
    if (!config.enablePopup) return;

    const modal = section.querySelector('#reviewPopupModal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.review-popup-close');
    const helpfulBtns = modal.querySelectorAll('.helpful-btn');
    const imagesContainer = modal.querySelector('#popupReviewImages');

    function setPopupInitials(name, initialsText) {
      const customerImage = modal.querySelector('#popupCustomerImage');
      const customerInitials = modal.querySelector('#popupCustomerInitials');
      if (!customerInitials) return;

      if (customerImage) {
        customerImage.style.display = 'none';
        customerImage.removeAttribute('src');
      }

      customerInitials.classList.remove('customer-initials--hidden');
      customerInitials.classList.add('customer-initials--visible');

      if (initialsText) {
        customerInitials.textContent = initialsText;
      } else {
        const parts = name.split(/\s+/).filter(Boolean);
        let initials = '';
        parts.forEach((part) => {
          initials += part.charAt(0);
        });
        customerInitials.textContent = initials.slice(0, 2).toUpperCase();
      }

      customerInitials.style.fontSize = `${(config.popupCustomerImageSize || 60) * 0.4}px`;
    }

    function setPopupCustomerImage(src, alt) {
      const customerImage = modal.querySelector('#popupCustomerImage');
      const customerInitials = modal.querySelector('#popupCustomerInitials');
      if (!customerImage) return;

      const showImage = () => {
        customerImage.style.display = 'block';
        if (customerInitials) {
          customerInitials.classList.remove('customer-initials--visible');
          customerInitials.classList.add('customer-initials--hidden');
        }
      };

      customerImage.onload = showImage;
      customerImage.onerror = () => setPopupInitials(alt, null);
      customerImage.src = src;
      customerImage.alt = alt;

      if (customerImage.complete && customerImage.naturalWidth > 0) {
        showImage();
      }
    }

    function openPopup(reviewData) {
      const setText = (id, value) => {
        const el = modal.querySelector('#' + id);
        if (el) el.textContent = value;
      };

      setText('popupCustomerName', reviewData.name);
      setText('popupReviewDate', reviewData.date);
      setText('popupReviewTitle', reviewData.title);
      setText('popupReviewText', reviewData.text);
      setText('popupRatingText', `${reviewData.rating} star${reviewData.rating !== 1 ? 's' : ''}`);

      if (reviewData.customerImage) {
        setPopupCustomerImage(reviewData.customerImage, `${reviewData.name} avatar`);
      } else {
        setPopupInitials(reviewData.name, reviewData.customerInitials);
      }

      const countryFlag = modal.querySelector('#popupCountryFlag');
      const flagIcon = modal.querySelector('#popupFlagIcon');
      if (countryFlag && flagIcon) {
        if (reviewData.countryFlagUrl && config.showCountryFlags) {
          flagIcon.style.backgroundImage = `url(${reviewData.countryFlagUrl})`;
          countryFlag.style.display = 'flex';
        } else {
          flagIcon.style.backgroundImage = '';
          countryFlag.style.display = 'none';
        }
      }

      const starsEl = modal.querySelector('#popupReviewStars');
      if (starsEl) {
        starsEl.innerHTML = generateStars(reviewData.rating, config);
      }

      if (imagesContainer) {
        if (reviewData.images.length) {
          imagesContainer.innerHTML = reviewData.images
            .map((image, i) => {
              const displaySrc = typeof image === 'string' ? image : image.display;
              const fullSrc = typeof image === 'string' ? image : image.full;
              return `<div class="review-popup-image${config.enableImageEnlarge ? ' review-popup-image--clickable' : ''}"${config.enableImageEnlarge ? ' role="button" tabindex="0" aria-label="View full size review image"' : ''}><img src="${displaySrc}" data-full-src="${fullSrc}" alt="Review image ${i + 1}" loading="lazy" decoding="async"></div>`;
            })
            .join('');
          imagesContainer.hidden = false;
          bindPopupReviewImages();
        } else {
          imagesContainer.innerHTML = '';
          imagesContainer.hidden = true;
        }
      }

      modal.classList.toggle('review-popup-modal--enlarge', Boolean(config.enableImageEnlarge));

      if (config.showPopupProductInfo) {
        const productInfo = modal.querySelector('#popupProductInfo');
        if (productInfo && reviewData.product) {
          setText('popupProductTitle', reviewData.product.title);
          const productImg = modal.querySelector('#popupProductImage');
          if (productImg && reviewData.product.image) {
            productImg.src = reviewData.product.image;
            productImg.alt = reviewData.product.title;
          }
          productInfo.style.display = 'flex';
        } else if (productInfo) {
          productInfo.style.display = 'none';
        }
      }

      if (config.showPopupHelpfulButtons) {
        const likeCount = modal.querySelector('#likeCount');
        const dislikeCount = modal.querySelector('#dislikeCount');
        if (likeCount) likeCount.textContent = reviewData.likeSize;
        if (dislikeCount) dislikeCount.textContent = reviewData.dislikeSize;
      }

      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => modal.classList.add('show'));
    }

    function closePopup() {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }, 300);
    }

    function bindPopupReviewImages() {
      if (!imagesContainer || !config.enableImageEnlarge) return;

      imagesContainer.querySelectorAll('.review-popup-image--clickable').forEach((wrap) => {
        const img = wrap.querySelector('img');
        if (!img) return;

        const activate = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openImageEnlarged(getEnlargeImageSrc(img.dataset.fullSrc || img.currentSrc || img.src), img.alt);
        };

        wrap.addEventListener('click', activate);
        wrap.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            activate(e);
          }
        });
      });
    }

    function openImageEnlarged(src, alt) {
      if (!src) return;

      const overlay = document.createElement('div');
      overlay.className = 'image-enlarged-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = `
        <div class="image-enlarged-content">
          <button type="button" class="image-enlarged-close" aria-label="Close">&times;</button>
          <img src="${src.replace(/"/g, '&quot;')}" alt="${(alt || 'Review image').replace(/"/g, '&quot;')}" loading="lazy" decoding="async">
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));

      const close = () => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
        document.removeEventListener('keydown', onKeydown, true);
      };

      const onKeydown = (e) => {
        if (e.key === 'Escape') {
          e.stopImmediatePropagation();
          close();
        }
      };

      overlay.querySelector('.image-enlarged-close').addEventListener('click', close);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.classList.contains('image-enlarged-content')) close();
      });
      document.addEventListener('keydown', onKeydown, true);
    }

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePopup();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'block') closePopup();
    });

    if (config.showPopupHelpfulButtons) {
      helpfulBtns.forEach((btn) => {
        btn.addEventListener('click', function () {
          const countEl = this.querySelector('span');
          if (!countEl) return;
          helpfulBtns.forEach((b) => b.classList.remove('active'));
          this.classList.add('active');
          countEl.textContent = String(parseInt(countEl.textContent, 10) + 1);
        });
      });
    }

    section._openReviewPopup = openPopup;
    bindPopupItems(section, config);
  }

  function bindPopupItems(section, config) {
    if (!config.enablePopup || !section._openReviewPopup) return;

    section.querySelectorAll('.rw-container-contant:not([data-popup-bound]):not(.rw-container-contant--preview)').forEach((item, index) => {
      item.dataset.popupBound = 'true';

      const open = () => section._openReviewPopup(extractReviewData(item));

      item.addEventListener('click', open);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });

      item.dataset.reviewId = `review-${index}`;
    });
  }

  function collectGalleryImages(section) {
    const images = [];

    const collectFromNode = (node) => {
      const reviewIndex = node.dataset.reviewIndex;
      const raw = node.getAttribute('data-gallery-images');
      if (!reviewIndex || !raw) return;

      let galleryData = [];
      try {
        galleryData = JSON.parse(raw);
      } catch (e) {
        return;
      }

      if (!Array.isArray(galleryData)) return;

      galleryData.forEach((image) => {
        if (!image || !image.url) return;
        images.push({
          reviewIndex,
          type: image.type || 'primary',
          url: image.url,
          alt: image.alt || '',
        });
      });
    };

    section.querySelectorAll('.rw-container-contant[data-gallery-images]:not(.rw-container-contant--preview)').forEach(collectFromNode);

    const deferredStore = section.querySelector('[data-lumin-review-deferred]');
    if (deferredStore) {
      deferredStore.querySelectorAll('template .rw-container-contant[data-gallery-images]').forEach(collectFromNode);
    }

    return images;
  }

  function bindThumbnailImages(container) {
    if (!container) return;

    container.querySelectorAll('.thumbnail-item img').forEach((img) => {
      const item = img.closest('.thumbnail-item');
      if (!item) return;

      const markLoaded = () => {
        item.classList.remove('loading');
        img.classList.add('loaded');
      };

      item.classList.remove('loading');
      img.classList.add('loaded');
      img.addEventListener('load', markLoaded);
      img.addEventListener('error', () => {
        item.classList.remove('loading');
        item.classList.add('empty');
      });
      if (!img.complete || !img.naturalWidth) {
        item.classList.add('loading');
        img.classList.remove('loaded');
      }
    });
  }

  function syncGalleryFromReviews(section) {
    const gallery = section.querySelector('.review-thumbnail-gallery');
    if (!gallery) return;

    const grid = gallery.querySelector('[data-lumin-gallery-grid]');
    const empty = gallery.querySelector('[data-lumin-gallery-empty]');
    const countEl = gallery.querySelector('[data-lumin-gallery-count]');
    if (!grid) return;

    const images = collectGalleryImages(section).sort((a, b) => {
      const indexDiff = parseInt(a.reviewIndex, 10) - parseInt(b.reviewIndex, 10);
      if (indexDiff !== 0) return indexDiff;
      if (a.type === 'primary' && b.type === 'secondary') return -1;
      if (a.type === 'secondary' && b.type === 'primary') return 1;
      return 0;
    });

    if (!images.length) {
      const existingItems = grid.querySelectorAll('.thumbnail-item');
      if (existingItems.length) {
        grid.hidden = false;
        if (empty) empty.hidden = true;
        bindThumbnailImages(grid);
        return;
      }
    }

    grid.innerHTML = '';
    images.forEach((image) => {
      const item = document.createElement('div');
      item.className = 'thumbnail-item';
      item.dataset.reviewIndex = image.reviewIndex;
      item.dataset.imageType = image.type;
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `View review ${image.reviewIndex}`);

      const img = document.createElement('img');
      img.className = 'thumbnail-image';
      img.src = image.url;
      img.alt = image.alt;
      img.loading = 'lazy';
      img.decoding = 'async';
      item.appendChild(img);
      grid.appendChild(item);
    });

    if (countEl) {
      if (images.length > 0) {
        countEl.textContent = `(${images.length} image${images.length !== 1 ? 's' : ''})`;
        countEl.hidden = false;
      } else {
        countEl.textContent = '';
        countEl.hidden = true;
      }
    }

    grid.hidden = images.length === 0;
    if (empty) empty.hidden = images.length > 0;

    bindThumbnailImages(grid);
  }

  function initThumbnails(section) {
    syncGalleryFromReviews(section);

    const gallery = section.querySelector('.review-thumbnail-gallery');
    if (!gallery) return;

    if (section.dataset.lrThumbnailsBound === 'true') return;
    section.dataset.lrThumbnailsBound = 'true';

    gallery.addEventListener('click', (e) => {
      const thumb = e.target.closest('.thumbnail-item');
      if (!thumb) return;

      const reviewIndex = parseInt(thumb.dataset.reviewIndex, 10);
      const target = section.querySelector(
        `.rw-container-contant[data-review-index="${reviewIndex}"]:not(.rw-container-contant--preview)`
      );
      if (!target) return;

      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('is-highlighted');
      setTimeout(() => target.classList.remove('is-highlighted'), 2000);
    });

    gallery.addEventListener('keydown', (e) => {
      const thumb = e.target.closest('.thumbnail-item');
      if (!thumb) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        thumb.click();
      }
    });
  }

  function initAddReview(section, config) {
    if (!config.showAddReviewButton) return;

    const modal = section.querySelector('#addReviewModal');
    const addBtn = section.querySelector('#addReviewBtn');
    const form = section.querySelector('#reviewForm');
    if (!modal || !addBtn || !form) return;

    const closeBtn = modal.querySelector('.close-modal');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const starLabels = modal.querySelectorAll('.star-label');
    const ratingText = modal.querySelector('.rating-text');

    function resetStars() {
      starLabels.forEach((l) => (l.style.color = '#ddd'));
      if (ratingText) ratingText.textContent = 'Select rating';
    }

    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      form.reset();
      resetStars();
    }

    addBtn.addEventListener('click', () => {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    starLabels.forEach((label, index) => {
      label.addEventListener('mouseenter', () => highlightStars(index));
      label.addEventListener('mouseleave', () => {
        const checked = form.querySelector('input[name="rating"]:checked');
        highlightStars(checked ? parseInt(checked.value, 10) - 1 : -1);
      });
      label.addEventListener('click', () => {
        const input = form.querySelector(`#star${index + 1}`);
        if (input) input.checked = true;
        highlightStars(index);
        const hidden = form.querySelector('#hiddenRating');
        if (hidden) hidden.value = index + 1;
        if (ratingText) ratingText.textContent = `${index + 1} star${index !== 0 ? 's' : ''}`;
      });
    });

    function highlightStars(index) {
      starLabels.forEach((l, i) => {
        l.style.color = i <= index ? '#ffd700' : '#ddd';
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const name = formData.get('contact[name]');
      const rating = formData.get('rating');
      const title = formData.get('contact[subject]');
      const text = formData.get('contact[body]');
      const email = formData.get('contact[email]');

      if (!name || !rating || !title || !text || !email) {
        alert('Please fill in all required fields and select a rating.');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address.');
        return;
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      const bodyField = form.querySelector('textarea[name="contact[body]"]');
      if (bodyField) {
        bodyField.value = `REVIEW SUBMITTED ON: ${dateStr}\n\nCustomer: ${name}\nEmail: ${email}\nRating: ${rating}/5\nTitle: ${title}\n\n${text}`;
      }

      const subjectField = form.querySelector('input[name="contact[subject]"]');
      if (subjectField) subjectField.value = `Review: ${title} - ${rating} stars`;

      showToast(config.successTitle + ' ' + config.successBody, config.successDuration, config);

      form.classList.add('form-submitting');
      const submitBtn = form.querySelector('.submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      setTimeout(() => form.submit(), 1500);
    });
  }

  function showToast(message, duration, config) {
    const toast = document.createElement('div');
    toast.className = 'lumin-review-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; z-index: 10001; padding: 16px 24px; border-radius: 8px;
      background: ${config.successBg || '#4CAF50'}; color: ${config.successText || '#fff'};
      font-size: ${config.successFontSize || 16}px; max-width: 320px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      top: 20px; right: 20px; opacity: 0; transition: opacity 0.3s ease;`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = '1'));
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration || 3000);
  }

  function initCustomerAvatarFallback(section) {
    section.querySelectorAll('.customer-avatar-img').forEach((img) => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
        const initials = img.nextElementSibling;
        if (initials) {
          initials.classList.remove('customer-initials--hidden');
          initials.classList.add('customer-initials--visible');
        }
      });
    });
  }

  function initSection(section) {
    if (section.hasAttribute('data-lumin-review-ready')) return;
    section.setAttribute('data-lumin-review-ready', 'true');

    const config = parseConfig(section);
    syncReviewOrderData(section);
    initPagination(section, config);
    refreshReviewLayout(section, config);
    bindReviewColumnResize(section, config);
    bindThemeEditorReviewSync(section, config);
    initPopup(section, config);
    initThumbnails(section);
    initAddReview(section, config);
    initCustomerAvatarFallback(section);
  }

  function initAll() {
    document.querySelectorAll('[data-lumin-review]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', (event) => {
    const section = event.target.querySelector('[data-lumin-review]') || event.target.closest('[data-lumin-review]');
    if (section) {
      section.dataset.lrThumbnailsBound = 'false';
      section._lrEditorSyncBound = false;
      section.removeAttribute('data-lumin-review-ready');
      initSection(section);
    }
  });
})();
