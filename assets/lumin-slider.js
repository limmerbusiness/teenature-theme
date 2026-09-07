// Standalone block slider (no Swiper.js)

// @ts-nocheck
class LuminSlider {
  constructor(container) {
    this.container = container;
    this.root =
      container.querySelector('[class*="lumin-slider-swiper-inner-"]') || container.querySelector('.lumin-slider');
    this.wrapper = this.root?.querySelector('.lumin-slider-wrapper');

    if (!this.root || !this.wrapper) return;

    this.originalSlides = [...this.wrapper.querySelectorAll('.lumin-slider-slide')];
    this.slideCount = this.originalSlides.length;

    if (this.slideCount === 0) return;

    this.readConfig();
    this.prevButton = this.root.querySelector('.lumin-slider-button-prev');
    this.nextButton = this.root.querySelector('.lumin-slider-button-next');
    this.paginationEl = this.root.querySelector('.lumin-slider-pagination');

    this.activeIndex = 0;
    this.realIndex = 0;
    this.slides = [];
    this.autoplayTimer = null;
    this.autoplayPaused = false;
    this.isTransitioning = false;
    this.reverseAutoplay = false;

    this.boundOnTransitionEnd = this.onTransitionEnd.bind(this);
    this.boundOnResize = this.onResize.bind(this);
    this.boundOnMouseEnter = () => this.stopAutoplay();
    this.boundOnMouseLeave = () => {
      if (this.autoplay) this.startAutoplay();
    };

    this.setupSlides();
    this.setupPagination();
    this.bindEvents();
    this.update(false);

    if (this.autoplay) {
      this.startAutoplay();
    }

    this.root._luminSlider = this;
  }

  readConfig() {
    const ds = this.container.dataset;
    this.breakpoints = {
      320: parseInt(ds.slidesMobile, 10) || 1,
      480: parseInt(ds.slidesSmallTablet, 10) || 2,
      750: parseInt(ds.slidesTablet, 10) || 2,
      1200: parseInt(ds.slidesLaptop, 10) || 3,
      1400: parseInt(ds.slidesDesktop, 10) || 3,
    };
    this.maxSlidesPerView = Math.max(...Object.values(this.breakpoints));
    this.autoplay = ds.autoplay === 'true';
    this.autoplayDelay = (parseInt(ds.autoplayDelay, 10) || 3) * 1000;
    this.autoplayReverse = ds.autoplayReverse === 'true';
    const gapParsed = parseInt(ds.gap, 10);
    this.gap = Number.isNaN(gapParsed) ? 12 : gapParsed;
    this.showNavigation = ds.showNavigation === 'true';
    this.showDots = ds.showDots === 'true';
    this.speed = 500;
    this.loop = ds.loop === 'true';
    this.reverseAutoplay = this.autoplayReverse;
  }

  getSlidesPerView() {
    const width = window.innerWidth;
    if (width >= 1400) return this.breakpoints[1400];
    if (width >= 1200) return this.breakpoints[1200];
    if (width >= 750) return this.breakpoints[750];
    if (width >= 480) return this.breakpoints[480];
    return this.breakpoints[320];
  }

  isLoopEnabled() {
    return this.loop && this.slideCount >= 2 && this.getMaxIndex() > 0;
  }

  setupSlides() {
    this.slides = [...this.originalSlides];
    this.activeIndex = Math.min(this.activeIndex || 0, this.getMaxIndex());
  }

  getLoopNextIndex() {
    const max = this.getMaxIndex();
    return this.activeIndex >= max ? 0 : this.activeIndex + 1;
  }

  getLoopPrevIndex() {
    const max = this.getMaxIndex();
    return this.activeIndex <= 0 ? max : this.activeIndex - 1;
  }

  setupPagination() {
    if (!this.showDots || !this.paginationEl) return;

    const pageCount = this.getPageCount();

    if (pageCount < 2) {
      this.paginationEl.innerHTML = '';
      this.paginationEl.hidden = true;
      return;
    }

    this.paginationEl.hidden = false;
    this.paginationEl.innerHTML = '';
    this.paginationEl.classList.add('lumin-slider-pagination-bullets');

    for (let i = 0; i < pageCount; i++) {
      const bullet = document.createElement('span');
      bullet.className = 'lumin-slider-pagination-bullet';
      bullet.setAttribute('role', 'button');
      bullet.setAttribute('tabindex', '0');
      bullet.setAttribute('aria-label', `Go to slide group ${i + 1}`);
      bullet.addEventListener('click', () => {
        this.stopAutoplay();
        this.slideTo(i);
        if (this.autoplay) this.startAutoplay();
      });
      this.paginationEl.appendChild(bullet);
    }

    this.updatePagination();
  }

  bindEvents() {
    this.wrapper.addEventListener('transitionend', this.boundOnTransitionEnd);
    window.addEventListener('resize', this.boundOnResize);

    this.prevButton?.addEventListener('click', () => {
      this.stopAutoplay();
      this.slidePrev();
      if (this.autoplay) this.startAutoplay();
    });

    this.nextButton?.addEventListener('click', () => {
      this.stopAutoplay();
      this.slideNext();
      if (this.autoplay) this.startAutoplay();
    });

    if (this.autoplay) {
      this.container.addEventListener('mouseenter', this.boundOnMouseEnter);
      this.container.addEventListener('mouseleave', this.boundOnMouseLeave);
    }
  }

  onResize() {
    const max = this.getMaxIndex();

    if (this.activeIndex > max) {
      this.activeIndex = this.isLoopEnabled() ? 0 : max;
    }

    this.setupPagination();
    this.update(false);
  }

  getMaxIndex() {
    const perView = this.getSlidesPerView();
    return Math.max(this.slideCount - perView, 0);
  }

  getPageCount() {
    const perView = this.getSlidesPerView();
    if (this.slideCount <= perView) return 1;
    return this.slideCount - perView + 1;
  }

  getActivePage() {
    const maxPage = this.getPageCount() - 1;
    return Math.max(0, Math.min(this.activeIndex, maxPage));
  }

  getRealIndex() {
    return this.activeIndex;
  }

  getGap() {
    if (!this.wrapper) return this.gap;
    const style = window.getComputedStyle(this.wrapper);
    const gap = parseFloat(style.columnGap || style.gap);
    return Number.isNaN(gap) ? this.gap : gap;
  }

  getTranslateForIndex(index) {
    if (!this.slides[index]) return 0;

    const gap = this.getGap();
    let offset = 0;

    for (let i = 0; i < index; i++) {
      offset += this.slides[i].offsetWidth + gap;
    }

    return -offset;
  }

  setTransition(duration) {
    this.wrapper.style.transitionDuration = `${duration}ms`;
    this.wrapper.style.transitionProperty = 'transform';
    this.wrapper.style.transitionTimingFunction = 'ease';
  }

  applyTransform(translateX, animate = true) {
    this.setTransition(animate ? this.speed : 0);
    this.wrapper.style.transform = `translate3d(${translateX}px, 0, 0)`;
  }

  slideTo(index) {
    if (this.isTransitioning || this.slideCount < 2) return;

    let target = index;

    if (!this.isLoopEnabled()) {
      target = Math.max(0, Math.min(index, this.getMaxIndex()));
    } else {
      const max = this.getMaxIndex();
      target = ((index % (max + 1)) + (max + 1)) % (max + 1);
    }

    if (target === this.activeIndex) return;

    this.isTransitioning = true;
    this.activeIndex = target;
    this.realIndex = this.getRealIndex();
    this.applyTransform(this.getTranslateForIndex(this.activeIndex), true);
    this.updateSlideClasses();
    this.updatePagination();
    this.updateNavigationState();
  }

  slideNext() {
    if (this.slideCount < 2) return;

    if (this.isLoopEnabled()) {
      this.slideTo(this.getLoopNextIndex());
      return;
    }

    if (this.activeIndex < this.getMaxIndex()) {
      this.slideTo(this.activeIndex + 1);
    }
  }

  slidePrev() {
    if (this.slideCount < 2) return;

    if (this.isLoopEnabled()) {
      this.slideTo(this.getLoopPrevIndex());
      return;
    }

    if (this.activeIndex > 0) {
      this.slideTo(this.activeIndex - 1);
    }
  }

  onTransitionEnd(event) {
    if (event.target !== this.wrapper || event.propertyName !== 'transform') return;

    this.isTransitioning = false;
    this.realIndex = this.getRealIndex();
    this.updateSlideClasses();
    this.updatePagination();
    this.updateNavigationState();
  }

  updateSlideClasses() {
    this.slides.forEach((slide, index) => {
      slide.classList.toggle('lumin-slider-slide-active', index === this.activeIndex);
      slide.classList.toggle('lumin-slider-slide-prev', index === this.activeIndex - 1);
      slide.classList.toggle('lumin-slider-slide-next', index === this.activeIndex + 1);
    });
  }

  updatePagination() {
    if (!this.showDots || !this.paginationEl || this.paginationEl.hidden) return;

    const activePage = this.getActivePage();
    this.paginationEl.querySelectorAll('.lumin-slider-pagination-bullet').forEach((bullet, index) => {
      bullet.classList.toggle('lumin-slider-pagination-bullet-active', index === activePage);
      bullet.setAttribute('aria-current', index === activePage ? 'true' : 'false');
    });
  }

  updateNavigationState() {
    if (this.isLoopEnabled() || this.slideCount < 2) {
      this.prevButton?.classList.remove('lumin-slider-button-disabled');
      this.nextButton?.classList.remove('lumin-slider-button-disabled');
      return;
    }

    this.prevButton?.classList.toggle('lumin-slider-button-disabled', this.activeIndex <= 0);
    this.nextButton?.classList.toggle('lumin-slider-button-disabled', this.activeIndex >= this.getMaxIndex());
  }

  update(animate = true) {
    if (!this.isLoopEnabled() && this.activeIndex > this.getMaxIndex()) {
      this.activeIndex = this.getMaxIndex();
    }

    this.applyTransform(this.getTranslateForIndex(this.activeIndex), animate);
    this.updateSlideClasses();
    this.updatePagination();
    this.updateNavigationState();
  }

  startAutoplay() {
    this.stopAutoplay();
    if (!this.autoplay || this.slideCount < 2) return;

    this.autoplayTimer = window.setTimeout(() => {
      if (this.reverseAutoplay) {
        this.slidePrev();
      } else {
        this.slideNext();
      }

      this.startAutoplay();
    }, this.autoplayDelay);
  }

  stopAutoplay() {
    if (this.autoplayTimer) {
      clearTimeout(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  destroy() {
    this.stopAutoplay();
    this.wrapper.removeEventListener('transitionend', this.boundOnTransitionEnd);
    window.removeEventListener('resize', this.boundOnResize);
    this.container.removeEventListener('mouseenter', this.boundOnMouseEnter);
    this.container.removeEventListener('mouseleave', this.boundOnMouseLeave);
    delete this.root._luminSlider;
  }

  updateSlides() {
    this.update(false);
  }
}

window.LuminSlider = LuminSlider;

function initLuminSlider(container) {
  if (!container || !window.LuminSlider) return null;

  const root =
    container.querySelector('[class*="lumin-slider-swiper-inner-"]') || container.querySelector('.lumin-slider');

  if (root?._luminSlider) {
    root._luminSlider.destroy();
  }

  return new LuminSlider(container);
}

window.initLuminSlider = initLuminSlider;
