class FrequentlyBoughtTogether extends HTMLElement {
  constructor() {
    super();
    this.button = this.querySelector("[data-fbt-add-to-cart]");
    this.buttonLabelTemplate =
      this.button?.dataset.fbtButtonLabel || "Add all [count] to cart";
    this.initiallyUnavailable = this.button?.disabled ?? false;

    this.querySelectorAll("[data-fbt-checkbox]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => this.onCheckboxChange(checkbox));
      checkbox.addEventListener("click", (event) => event.stopPropagation());
    });

    this.querySelectorAll("[data-fbt-variant-select]").forEach((select) => {
      select.addEventListener("change", () => this.onVariantSelectChange(select));
    });

    if (this.button) {
      this.button.addEventListener("click", () => this.addToCart());
    }
  }

  onCheckboxChange(checkbox) {
    const item = checkbox.closest("[data-fbt-item]");
    if (item) {
      item.setAttribute(
        "data-fbt-selected",
        checkbox.checked ? "true" : "false"
      );
    }
    this.updateTotals();
  }

  onVariantSelectChange(select) {
    const item = select.closest("[data-fbt-item]");
    if (!item) return;

    const option = select.selectedOptions[0];
    if (!option) return;

    this.updateItemImage(item, option.dataset.variantImg);
    this.updateItemAvailability(item, !option.disabled);
    this.updateTotals();
  }

  getHighResImageUrl(src, width = 400) {
    if (!src) return src;

    try {
      const url = new URL(src, window.location.origin);
      url.searchParams.set("width", String(width));
      return url.toString();
    } catch {
      return src;
    }
  }

  updateItemImage(item, imageSrc) {
    if (!imageSrc) return;

    const img = item.querySelector(".fbt__image");
    if (img) {
      img.src = this.getHighResImageUrl(imageSrc);
      img.removeAttribute("srcset");
    }
  }

  updateItemAvailability(item, isAvailable) {
    const checkbox = item.querySelector("[data-fbt-checkbox]");
    if (checkbox) {
      checkbox.disabled = !isAvailable;
    }
  }

  isItemSelected(item) {
    if (item.hasAttribute("data-fbt-required")) return true;
    const checkbox = item.querySelector("[data-fbt-checkbox]");
    return checkbox ? checkbox.checked : true;
  }

  getVariantDataFromItem(item) {
    const select = item.querySelector("[data-fbt-variant-select]");
    if (select) {
      const option = select.selectedOptions[0];
      if (!option?.value) return null;
      return {
        id: Number(option.value),
        quantity: 1,
        price: Number(option.dataset.price) || 0,
        comparePrice: Number(option.dataset.comparePrice) || 0,
        available: !option.disabled,
      };
    }

    const input = item.querySelector("[data-fbt-variant-input]");
    if (!input?.value) return null;

    return {
      id: Number(input.value),
      quantity: 1,
      price: Number(input.dataset.price) || 0,
      comparePrice: Number(input.dataset.comparePrice) || 0,
      available: true,
    };
  }

  getSelectedItemsData() {
    const items = [];
    this.querySelectorAll("[data-fbt-item]").forEach((item) => {
      if (!this.isItemSelected(item)) return;

      const variantData = this.getVariantDataFromItem(item);
      if (variantData) {
        items.push(variantData);
      }
    });
    return items;
  }

  getItems() {
    return this.getSelectedItemsData().map(({ id, quantity }) => ({
      id,
      quantity,
    }));
  }

  formatMoney(amount) {
    const cents = Number(amount) || 0;

    if (typeof window.Theme !== "undefined" && typeof Theme.formatMoney === "function") {
      return String(Theme.formatMoney(cents)).replace(/\.00$/, "");
    }

    if (window.Shopify?.formatMoney) {
      const formatted = window.Shopify.formatMoney(
        cents,
        window.Theme?.moneyFormat || window.Shopify.money_format
      );
      const tmp = document.createElement("div");
      tmp.innerHTML = formatted;
      return (tmp.textContent || tmp.innerText || "").replace(/\.00$/, "");
    }

    return new Intl.NumberFormat(document.documentElement.lang || "en", {
      style: "currency",
      currency: window.Theme?.currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }

  getItemDisplayPrices(basePrice, compareAtPrice, totalPrice) {
    const enableDiscount = this.dataset.enableDiscount === "true";
    let salePrice = basePrice;
    let displayCompare = 0;
    let showStrikethrough = false;

    if (enableDiscount && totalPrice > 0 && basePrice > 0) {
      displayCompare = basePrice;

      if (this.dataset.discountType === "percentage") {
        const discountFactor =
          100 - (Number(this.dataset.discountPercentage) || 0);
        salePrice = Math.floor((basePrice * discountFactor) / 100);
      } else {
        const discountFixed = Number(this.dataset.discountFixed) || 0;
        const itemSavings = Math.floor(
          (discountFixed * basePrice) / totalPrice
        );
        salePrice = Math.max(0, basePrice - itemSavings);
      }

      showStrikethrough = salePrice < displayCompare;
    } else if (compareAtPrice > basePrice) {
      displayCompare = compareAtPrice;
      showStrikethrough = true;
    }

    return { salePrice, displayCompare, showStrikethrough };
  }

  updateItemPriceDisplay(item, basePrice, compareAtPrice, totalPrice) {
    const priceEl = item.querySelector(".fbt__product-price");
    if (!priceEl) return;

    const { salePrice, displayCompare, showStrikethrough } =
      this.getItemDisplayPrices(basePrice, compareAtPrice, totalPrice);

    if (showStrikethrough) {
      priceEl.innerHTML = `
        <span class="visually-hidden">Regular price</span>
        <s class="fbt__product-compare">${this.formatMoney(displayCompare)}</s>
        <span class="visually-hidden">Sale price</span>
        <span class="fbt__product-sale">${this.formatMoney(salePrice)}</span>
      `;
    } else {
      priceEl.textContent = this.formatMoney(salePrice);
    }
  }

  updateTotals() {
    const selectedItems = this.getSelectedItemsData();
    let totalPrice = 0;
    let totalComparePrice = 0;
    let allAvailable = true;

    selectedItems.forEach((item) => {
      totalPrice += item.price;
      totalComparePrice += item.comparePrice;
      if (item.available === false) {
        allAvailable = false;
      }
    });

    this.querySelectorAll("[data-fbt-item]").forEach((item) => {
      if (!this.isItemSelected(item)) return;
      const variantData = this.getVariantDataFromItem(item);
      if (!variantData) return;
      this.updateItemPriceDisplay(
        item,
        variantData.price,
        variantData.comparePrice,
        totalPrice
      );
    });

    const enableDiscount = this.dataset.enableDiscount === "true";
    const discountType = this.dataset.discountType || "percentage";
    const discountPercentage = Number(this.dataset.discountPercentage) || 0;
    const discountFixed = Number(this.dataset.discountFixed) || 0;
    const showSavings = this.dataset.showSavings === "true";
    const savingsLabel = this.dataset.savingsLabel || "Save [amount]";
    const compareSavingsLabel =
      this.dataset.compareSavingsLabel || "You save: [amount]";

    let savingsAmount = 0;
    let discountedTotal = totalPrice;
    let footerCompareTotal = totalPrice;
    let showFooterTotals = totalPrice > 0;
    let showFooterCompare = false;

    if (enableDiscount && totalPrice > 0) {
      if (discountType === "fixed") {
        savingsAmount = discountFixed;
      } else {
        savingsAmount = Math.floor((totalPrice * discountPercentage) / 100);
      }
      discountedTotal = Math.max(0, totalPrice - savingsAmount);
      if (savingsAmount > 0) {
        footerCompareTotal = totalPrice;
        showFooterCompare = true;
      }
    } else if (totalComparePrice > totalPrice) {
      savingsAmount = totalComparePrice - totalPrice;
      discountedTotal = totalPrice;
      footerCompareTotal = totalComparePrice;
      showFooterCompare = true;
    }

    const totalsEl = this.querySelector(".fbt__totals");
    if (totalsEl) {
      totalsEl.hidden = !showFooterTotals;
    }

    const compareEl = this.querySelector(".fbt__compare-total");
    if (compareEl) {
      compareEl.textContent = this.formatMoney(footerCompareTotal);
      compareEl.hidden = !showFooterCompare;
    }

    const discountedEl = this.querySelector("[data-fbt-discounted-total]");
    if (discountedEl) {
      discountedEl.textContent = this.formatMoney(discountedTotal);
    }

    const savingsEls = this.querySelectorAll("[data-fbt-savings]");
    savingsEls.forEach((el) => {
      if (!showFooterTotals || savingsAmount <= 0) {
        el.hidden = true;
        return;
      }

      el.hidden = false;
      if (enableDiscount && showSavings) {
        el.textContent = savingsLabel.replace(
          "[amount]",
          this.formatMoney(savingsAmount)
        );
      } else if (!enableDiscount) {
        el.textContent = compareSavingsLabel.replace(
          "[amount]",
          this.formatMoney(savingsAmount)
        );
      }
    });

    const buttonTextEl = this.querySelector("[data-fbt-button-text]");
    if (buttonTextEl) {
      buttonTextEl.textContent = this.buttonLabelTemplate.replace(
        "[count]",
        selectedItems.length
      );
    }

    if (this.button) {
      this.button.disabled =
        this.initiallyUnavailable || selectedItems.length === 0 || !allAvailable;
    }
  }

  async addToCart() {
    const items = this.getItems();
    if (!items.length || !this.button) return;

    this.button.classList.add("loading");
    this.button.disabled = true;
    this.button.setAttribute("aria-busy", "true");
    this.button.querySelector(".loading__spinner")?.classList.remove("hidden");

    try {
      const response = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const responseData = await response.json();

      if (responseData.status) {
        throw new Error(responseData.message || "Failed to add bundle to cart");
      }

      let cartPayload = responseData;
      try {
        const cartRes = await fetch(
          `${((window.Theme?.routes?.cart_url) || "/cart").replace(/\/?$/, "")}.js`
        );
        cartPayload = await cartRes.json();
      } catch (_) {
        // Keep add response if cart fetch fails
      }

      document.dispatchEvent(
        new CustomEvent("cart:update", {
          bubbles: true,
          detail: {
            resource: cartPayload,
            sourceId: this.dataset.blockId || "frequently-bought-together",
            data: {
              source: "frequently-bought-together",
              itemCount: items.length,
              sections: responseData.sections || {},
            },
          },
        })
      );

      const cartType = window.Theme?.cart?.type;
      const autoOpenDrawer =
        cartType === "drawer" && window.Theme?.cart?.auto_open_drawer;
      const autoOpenPage =
        cartType === "page" && window.Theme?.cart?.auto_open_page;

      if (autoOpenDrawer) {
        const drawer = document.querySelector("cart-drawer-component");
        if (drawer?.open) drawer.open();
      } else if (autoOpenPage) {
        window.location.href =
          window.Theme?.routes?.cart_url ||
          `${window.Shopify.routes.root}cart`;
      }
    } catch (error) {
      console.error("Error adding bundle to cart:", error);
      if (window.Theme?.cart?.type === "page" && window.Theme?.cart?.auto_open_page) {
        window.location.href =
          window.Theme?.routes?.cart_url ||
          `${window.Shopify.routes.root}cart`;
      }
    } finally {
      this.button.classList.remove("loading");
      this.updateTotals();
      this.button.setAttribute("aria-busy", "false");
      this.button.querySelector(".loading__spinner")?.classList.add("hidden");
    }
  }
}

customElements.define("frequently-bought-together", FrequentlyBoughtTogether);
