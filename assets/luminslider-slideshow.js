// Lumin Slideshow — standalone carousel (no Swiper.js dependency)

// @ts-nocheck
class LuminSliderSlideshow {
  constructor() {
    this.instances = new Map();
    this.resizeObservers = new Map();
    this.userInteracted = false;
    this.resizeObserver = null;
    this.handleWindowResize = null;
    this.setupUserInteractionHandler();
    this.init();
  }

  setupUserInteractionHandler() {
    const enableAutoplay = () => {
      this.userInteracted = true;
      this.instances.forEach((instance) => {
        this.handleVideoAutoplay(instance.element);
      });
    };

    ['click', 'touchstart', 'keydown'].forEach((event) => {
      document.addEventListener(event, enableAutoplay, { once: true });
    });
  }

  init() {
    this.initSlideshows();

    document.addEventListener('shopify:section:load', (event) => {
      this.initSlideshows(event.target);
    });

    document.addEventListener('shopify:section:unload', (event) => {
      this.destroySlideshows(event.target);
    });

    this.setupResizeObserver();
    this.setupWindowResizeListener();
  }

  initSlideshows(container = document) {
    container.querySelectorAll('.luminslider-slideshow').forEach((element) => {
      if (this.instances.has(element)) return;
      const instance = new SlideshowInstance(element, this);
      this.instances.set(element, instance);
    });
  }

  destroySlideshows(container) {
    container.querySelectorAll('.luminslider-slideshow').forEach((element) => {
      const instance = this.instances.get(element);
      if (instance) {
        instance.destroy();
        this.instances.delete(element);
      }
    });
  }

  getSlider(element) {
    return this.instances.get(element);
  }

  destroyAll() {
    this.instances.forEach((instance) => instance.destroy());
    this.instances.clear();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.handleWindowResize) {
      window.removeEventListener('resize', this.handleWindowResize);
      this.handleWindowResize = null;
    }
  }

  handleVideoAutoplay(element) {
    const activeSlide = element.querySelector('.luminslider-slide-active');
    if (!activeSlide) return;

    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768;

    let activeVideo = null;
    if (isMobile) {
      activeVideo =
        activeSlide.querySelector('.luminslider-slide-video-mobile video') ||
        activeSlide.querySelector('.luminslider-slide-video-desktop video') ||
        activeSlide.querySelector('video');
    } else {
      activeVideo =
        activeSlide.querySelector('.luminslider-slide-video-desktop video') ||
        activeSlide.querySelector('.luminslider-slide-video-mobile video') ||
        activeSlide.querySelector('video');
    }

    const allVideos = element.querySelectorAll('video');
    allVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
      video.load();
    });

    if (activeVideo) {
      const autoplayValue = activeSlide.dataset.autoplay;
      const autoplayEnabled = autoplayValue === 'true' || autoplayValue === true;
      const showControlsValue = activeSlide.dataset.showControls;
      const showControls = showControlsValue === 'true' || showControlsValue === true;

      setTimeout(() => {
        this.playActiveVideo(activeVideo, autoplayEnabled, showControls);
      }, 50);
    }
  }

  playActiveVideo(video, autoplayEnabled, showControls) {
    if (!video) return;

    video.muted = true;

    if (!showControls) {
      video.controls = false;
    }

    if (autoplayEnabled && this.userInteracted) {
      if (video.paused) {
        video.currentTime = 0;

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (showControls) {
                video.controls = true;
              }

              const handleVideoEnd = () => {
                if (autoplayEnabled && this.userInteracted) {
                  video.currentTime = 0;
                  video.play().catch(() => {});
                }
              };

              video.removeEventListener('ended', handleVideoEnd);
              video.addEventListener('ended', handleVideoEnd);
            })
            .catch(() => {
              if (showControls) {
                video.controls = true;
              }
            });
        }
      }
    } else if (autoplayEnabled && !this.userInteracted) {
      if (showControls) {
        video.controls = true;
      }
    } else if (video.hasAttribute('autoplay') && !this.userInteracted) {
      if (video.paused) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (showControls) {
                video.controls = true;
              }
            })
            .catch(() => {
              if (showControls) {
                video.controls = true;
              }
            });
        }
      } else if (showControls) {
        video.controls = true;
      }
    } else if (showControls) {
      video.controls = true;
    }
  }

  ensureAnimationsWork(element) {
    setTimeout(() => {
      const activeSlide = element.querySelector('.luminslider-slide-active');
      if (!activeSlide) return;

      activeSlide.classList.add('luminslider-slide-active');

      activeSlide.querySelectorAll('.luminslider-slide-content-inner').forEach((contentElement) => {
        const animationClass = Array.from(contentElement.classList).find((cls) =>
          cls.startsWith('luminslider-slide-animate-')
        );

        if (animationClass) {
          contentElement.classList.remove(animationClass);
          contentElement.offsetHeight;
          setTimeout(() => {
            contentElement.classList.add(animationClass);
          }, 10);
        }
      });
    }, 50);
  }

  setupSmoothLoading(element) {
    element.querySelectorAll('.luminslider-slide-img, .luminslider-slide-video-poster, .luminslider-slide-bg-img').forEach((img) => {
      if (img.complete && img.naturalHeight !== 0) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', () => img.classList.add('loaded'));
        img.addEventListener('error', () => img.classList.add('loaded'));
      }
    });

    element.querySelectorAll('.luminslider-slide-video-element').forEach((video) => {
      if (video.readyState >= 2) {
        video.classList.add('loaded');
      } else {
        video.addEventListener('loadedmetadata', () => video.classList.add('loaded'));
        video.addEventListener('canplay', () => video.classList.add('loaded'));
        video.addEventListener('error', () => video.classList.add('loaded'));
      }
    });
  }

  handleAdaptiveHeight(element) {
    if (!element.classList.contains('luminslider-slideshow--adaptive')) return;

    const container = element.closest('.luminslider-slideshow-container');
    if (!container) return;

    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return;

    const aspectRatio = parseFloat(getComputedStyle(element).getPropertyValue('--aspect-ratio')) || 1;
    const maxHeight = parseFloat(getComputedStyle(element).getPropertyValue('--max-height')) || 800;
    const calculatedHeight = containerWidth / aspectRatio;
    const finalHeight = Math.min(calculatedHeight, maxHeight);
    const currentHeight = element.offsetHeight;

    if (Math.abs(currentHeight - finalHeight) > 1) {
      element.style.height = `${finalHeight}px`;
    }
  }

  setupResizeObserver() {
    if (this.resizeObserver) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const element = entry.target.querySelector('.luminslider-slideshow--adaptive');
        if (element) {
          this.handleAdaptiveHeight(element);
        }

        const slideshow = entry.target.querySelector('.luminslider-slideshow');
        const instance = slideshow && this.instances.get(slideshow);
        if (instance) {
          instance.onResize();
        }
      });
    });

    document.querySelectorAll('.luminslider-slideshow-container').forEach((container) => {
      this.resizeObserver.observe(container);
    });
  }

  setupWindowResizeListener() {
    let resizeTimeout;
    this.handleWindowResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        document.querySelectorAll('.luminslider-slideshow--adaptive').forEach((element) => {
          this.handleAdaptiveHeight(element);
        });
        this.instances.forEach((instance) => instance.onResize());
      }, 100);
    };

    window.addEventListener('resize', this.handleWindowResize);
  }
}

class SlideshowInstance {
  constructor(element, manager) {
    this.element = element;
    this.manager = manager;
    this.wrapper = element.querySelector('.luminslider-wrapper');
    this.originalSlides = [...this.wrapper.querySelectorAll('.luminslider-slide')];
    this.slideCount = this.originalSlides.length;

    if (this.slideCount === 0) return;

    this.readConfig();
    this.prevButton = element.querySelector('.luminslider-button-prev');
    this.nextButton = element.querySelector('.luminslider-button-next');
    this.paginationEl =
      element.closest('.luminslider-slideshow-container')?.querySelector('.luminslider-pagination') ||
      element.querySelector('.luminslider-pagination');

    this.activeIndex = 0;
    this.realIndex = 0;
    this.autoplayTimer = null;
    this.isTransitioning = false;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchDeltaX = 0;
    this.isDragging = false;
    this.slideWidth = 0;
    this.slides = [];

    this.boundOnTransitionEnd = this.onTransitionEnd.bind(this);
    this.boundOnMouseEnter = this.onMouseEnter.bind(this);
    this.boundOnMouseLeave = this.onMouseLeave.bind(this);
    this.boundOnTouchStart = this.onTouchStart.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchEnd = this.onTouchEnd.bind(this);

    this.setupEffectLayout();
    this.setupSlides();
    this.setupPagination();
    this.bindEvents();
    this.update(false);

    this.manager.setupSmoothLoading(element);
    this.manager.handleAdaptiveHeight(element);
    this.manager.handleVideoAutoplay(element);
    this.manager.ensureAnimationsWork(element);

    if (this.autoplay) {
      this.startAutoplay();
    }

    if (element.classList.contains('luminslider-slideshow--adaptive') && manager.resizeObserver) {
      const container = element.closest('.luminslider-slideshow-container');
      if (container) {
        manager.resizeObserver.observe(container);
      }
    }
  }

  readConfig() {
    const ds = this.element.dataset;
    this.autoplay = ds.autoplay === 'true';
    this.autoplayDelay = parseInt(ds.autoplayDelay, 10) || 4000;
    this.loop = ds.loop === 'true';
    this.effect = ds.effect === 'fade' ? 'fade' : 'slide';
    this.speed = parseInt(ds.speed, 10) || 500;
    this.spaceBetween = parseInt(ds.spaceBetween, 10) || 0;
    this.slidesPerView = parseInt(ds.slidesPerView, 10) || 1;
    this.slidesPerViewMobile = parseInt(ds.slidesPerViewMobile, 10) || 1;
    this.showNavigation = ds.showNavigation === 'true';
    this.showPagination = ds.showPagination === 'true';
    this.paginationType = ds.paginationType || 'bullets';
  }

  getSlidesPerView() {
    if (this.effect !== 'slide') return 1;
    const perView = window.innerWidth >= 768 ? this.slidesPerView : this.slidesPerViewMobile;
    if (this.loop && this.slideCount <= perView) {
      return 1;
    }
    return perView;
  }

  setupEffectLayout() {
    this.element.dataset.effect = this.effect;

    if (this.effect === 'fade') {
      this.wrapper.classList.add('luminslider-wrapper--fade');
    }
  }

  setupSlides() {
    this.slides = [...this.originalSlides];
    this.activeIndex = 0;
  }

  getLoopNextIndex() {
    if (this.effect === 'slide') {
      const max = this.getMaxIndex();
      return this.activeIndex >= max ? 0 : this.activeIndex + 1;
    }

    return (this.activeIndex + 1) % this.slideCount;
  }

  getLoopPrevIndex() {
    if (this.effect === 'slide') {
      const max = this.getMaxIndex();
      return this.activeIndex <= 0 ? max : this.activeIndex - 1;
    }

    return (this.activeIndex - 1 + this.slideCount) % this.slideCount;
  }

  clearTransitionLock() {
    this.isTransitioning = false;
    if (this._transitionTimer) {
      clearTimeout(this._transitionTimer);
      this._transitionTimer = null;
    }
  }

  lockTransition() {
    this.isTransitioning = true;
    if (this._transitionTimer) {
      clearTimeout(this._transitionTimer);
    }
    this._transitionTimer = window.setTimeout(() => {
      this.clearTransitionLock();
      this.manager.handleVideoAutoplay(this.element);
    }, this.speed + 100);
  }

  setupPagination() {
    if (!this.showPagination || !this.paginationEl) return;

    this.paginationEl.innerHTML = '';
    this.paginationEl.classList.remove('luminslider-pagination-bullets', 'luminslider-pagination-fraction', 'luminslider-pagination-progressbar');

    if (this.paginationType === 'bullets') {
      this.paginationEl.classList.add('luminslider-pagination-bullets');
      for (let i = 0; i < this.slideCount; i++) {
        const bullet = document.createElement('span');
        bullet.className = 'luminslider-pagination-bullet';
        bullet.setAttribute('role', 'button');
        bullet.setAttribute('tabindex', '0');
        bullet.setAttribute('aria-label', `Go to slide ${i + 1}`);
        bullet.addEventListener('click', () => this.slideToLoop(i));
        this.paginationEl.appendChild(bullet);
      }
    } else if (this.paginationType === 'fraction') {
      this.paginationEl.classList.add('luminslider-pagination-fraction');
      this.paginationEl.textContent = `1 / ${this.slideCount}`;
    } else if (this.paginationType === 'progressbar') {
      this.paginationEl.classList.add('luminslider-pagination-progressbar', 'luminslider-pagination-horizontal');
      const fill = document.createElement('span');
      fill.className = 'luminslider-pagination-progressbar-fill';
      this.paginationEl.appendChild(fill);
    }
  }

  bindEvents() {
    this.wrapper.addEventListener('transitionend', this.boundOnTransitionEnd);

    if (this.prevButton) {
      this.prevButton.addEventListener('click', () => this.slidePrev());
    }

    if (this.nextButton) {
      this.nextButton.addEventListener('click', () => this.slideNext());
    }

    if (this.autoplay) {
      this.element.addEventListener('mouseenter', this.boundOnMouseEnter);
      this.element.addEventListener('mouseleave', this.boundOnMouseLeave);
    }

    this.element.addEventListener('touchstart', this.boundOnTouchStart, { passive: true });
    this.element.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.boundOnTouchEnd);
  }

  onMouseEnter() {
    this.stopAutoplay();
  }

  onMouseLeave() {
    if (this.autoplay) {
      this.startAutoplay();
    }
  }

  onTouchStart(event) {
    if (event.touches.length !== 1) return;
    this.touchStartX = event.touches[0].clientX;
    this.touchStartY = event.touches[0].clientY;
    this.touchDeltaX = 0;
    this.isDragging = true;
    this.stopAutoplay();
    if (this.effect === 'slide') {
      this.setTransition(0);
    }
  }

  onTouchMove(event) {
    if (!this.isDragging || event.touches.length !== 1) return;

    const deltaX = event.touches[0].clientX - this.touchStartX;
    const deltaY = event.touches[0].clientY - this.touchStartY;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      this.isDragging = false;
      return;
    }

    if (this.effect === 'slide') {
      event.preventDefault();
      this.touchDeltaX = deltaX;
      this.applySlideTransform(this.getTranslateForIndex(this.activeIndex) + deltaX, false);
      return;
    }

    this.touchDeltaX = deltaX;
  }

  onTouchEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const threshold = this.effect === 'slide' ? Math.min(80, this.slideWidth * 0.2) : 50;

    if (this.touchDeltaX < -threshold) {
      this.slideNext();
    } else if (this.touchDeltaX > threshold) {
      this.slidePrev();
    } else if (this.effect === 'slide') {
      this.setTransition(this.speed);
      this.update(true);
    }

    if (this.autoplay) {
      this.startAutoplay();
    }
  }

  onResize() {
    this.update(false);
    this.manager.handleAdaptiveHeight(this.element);
  }

  getMaxIndex() {
    if (this.effect !== 'slide') {
      return this.slideCount - 1;
    }

    const perView = this.getSlidesPerView();
    return Math.max(this.slides.length - perView, 0);
  }

  getRealIndex() {
    return this.activeIndex;
  }

  slideToLoop(realIndex) {
    this.slideTo(realIndex);
  }

  slideTo(index) {
    if (this.isTransitioning || this.slideCount < 2) return;

    let target = index;

    if (!this.loop) {
      const maxIndex = this.effect === 'slide' ? this.getMaxIndex() : this.slideCount - 1;
      target = Math.max(0, Math.min(index, maxIndex));
    }

    if (target === this.activeIndex) return;

    this.lockTransition();
    this.activeIndex = target;
    this.realIndex = this.getRealIndex();
    this.element.style.setProperty('--slideshow-speed', `${this.speed}ms`);
    this.update(true);
    this.onSlideChange();
  }

  slideNext() {
    if (this.slideCount < 2) return;

    if (this.loop) {
      this.slideTo(this.getLoopNextIndex());
      return;
    }

    if (this.effect === 'slide' && this.activeIndex < this.getMaxIndex()) {
      this.slideTo(this.activeIndex + 1);
    } else if (this.effect === 'fade' && this.activeIndex < this.slideCount - 1) {
      this.slideTo(this.activeIndex + 1);
    }
  }

  slidePrev() {
    if (this.slideCount < 2) return;

    if (this.loop) {
      this.slideTo(this.getLoopPrevIndex());
      return;
    }

    if (this.activeIndex > 0) {
      this.slideTo(this.activeIndex - 1);
    }
  }

  onTransitionEnd(event) {
    if (event.target !== this.wrapper || event.propertyName !== 'transform') return;

    this.clearTransitionLock();
    this.manager.handleVideoAutoplay(this.element);
  }

  onSlideChange() {
    this.realIndex = this.getRealIndex();
    this.updatePagination();
    this.updateNavigationState();
    this.manager.handleVideoAutoplay(this.element);
    this.manager.ensureAnimationsWork(this.element);

    if (this.autoplay) {
      this.startAutoplay();
    }
  }

  setTransition(duration) {
    this.wrapper.style.transitionDuration = `${duration}ms`;
    this.slides.forEach((slide) => {
      slide.style.transitionDuration = `${duration}ms`;
    });
  }

  getTranslateForIndex(index) {
    return -(index * (this.slideWidth + this.spaceBetween));
  }

  applySlideTransform(translateX, animate = true) {
    this.setTransition(animate ? this.speed : 0);
    this.wrapper.style.transform = `translate3d(${translateX}px, 0, 0)`;
  }

  updateSlideClasses() {
    this.slides.forEach((slide, index) => {
      slide.classList.toggle('luminslider-slide-active', index === this.activeIndex);
      slide.classList.toggle('luminslider-slide-prev', index === this.activeIndex - 1);
      slide.classList.toggle('luminslider-slide-next', index === this.activeIndex + 1);
    });
  }

  updatePagination() {
    if (!this.showPagination || !this.paginationEl) return;

    const realIndex = this.getRealIndex();

    if (this.paginationType === 'bullets') {
      this.paginationEl.querySelectorAll('.luminslider-pagination-bullet').forEach((bullet, index) => {
        bullet.classList.toggle('luminslider-pagination-bullet-active', index === realIndex);
        bullet.setAttribute('aria-current', index === realIndex ? 'true' : 'false');
      });
    } else if (this.paginationType === 'fraction') {
      this.paginationEl.textContent = `${realIndex + 1} / ${this.slideCount}`;
    } else if (this.paginationType === 'progressbar') {
      const fill = this.paginationEl.querySelector('.luminslider-pagination-progressbar-fill');
      if (fill) {
        const progress = this.slideCount > 1 ? (realIndex + 1) / this.slideCount : 1;
        fill.style.transform = `scaleX(${progress})`;
      }
    }
  }

  updateNavigationState() {
    if (this.loop || this.slideCount < 2) {
      this.prevButton?.classList.remove('luminslider-button-disabled');
      this.nextButton?.classList.remove('luminslider-button-disabled');
      return;
    }

    this.prevButton?.classList.toggle('luminslider-button-disabled', this.activeIndex <= 0);
    this.nextButton?.classList.toggle('luminslider-button-disabled', this.activeIndex >= this.getMaxIndex());
  }

  update(animate = true) {
    const perView = this.getSlidesPerView();
    const containerWidth = this.element.offsetWidth;

    if (this.effect === 'slide') {
      this.slideWidth = perView > 0 ? (containerWidth - this.spaceBetween * (perView - 1)) / perView : containerWidth;

      this.slides.forEach((slide) => {
        slide.style.width = `${this.slideWidth}px`;
        slide.style.marginRight = `${this.spaceBetween}px`;
        slide.style.flexShrink = '0';
      });

      this.applySlideTransform(this.getTranslateForIndex(this.activeIndex), animate);
    } else if (this.effect === 'fade') {
      this.slides.forEach((slide) => {
        slide.style.width = '100%';
        slide.style.marginRight = '0';
      });
    }

    this.updateSlideClasses();
    this.updatePagination();
    this.updateNavigationState();
  }

  startAutoplay() {
    this.stopAutoplay();
    if (!this.autoplay || this.slideCount < 2) return;

    this.autoplayTimer = window.setTimeout(() => {
      this.slideNext();
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
    this.clearTransitionLock();
    this.wrapper.removeEventListener('transitionend', this.boundOnTransitionEnd);
    this.element.removeEventListener('mouseenter', this.boundOnMouseEnter);
    this.element.removeEventListener('mouseleave', this.boundOnMouseLeave);
    this.element.removeEventListener('touchstart', this.boundOnTouchStart);
    this.element.removeEventListener('touchmove', this.boundOnTouchMove);
    this.element.removeEventListener('touchend', this.boundOnTouchEnd);
  }
}

if (!window.__luminSliderSlideshowManager) {
  const initSlideshowManager = () => {
    if (!window.__luminSliderSlideshowManager) {
      window.__luminSliderSlideshowManager = new LuminSliderSlideshow();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSlideshowManager);
  } else {
    initSlideshowManager();
  }
}

window.LuminSliderSlideshow = LuminSliderSlideshow;
