(function () {
  if (typeof window.__te_d !== 'string' || !(window.Shopify && window.Shopify.designMode)) return;

  var OVERLAY_ID = atob('djItZA==');
  var PURCHASE_URL = atob('aHR0cHM6Ly93d3cubHVtaW50aGVtZS5jb20=');
  var ACTIVATE_URL = atob('aHR0cHM6Ly9hY3RpdmF0ZS5sdW1pbnRoZW1lLmNvbS8=');
  var FONT_FAMILY = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var COPY_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';

  function setStyles(el, styles) {
    for (var key in styles) {
      if (Object.prototype.hasOwnProperty.call(styles, key)) el.style[key] = styles[key];
    }
    return el;
  }

  function createEl(tag, styles, text) {
    var el = document.createElement(tag);
    if (styles) setStyles(el, styles);
    if (text != null) el.textContent = text;
    return el;
  }

  function createLink(href, text, styles) {
    var el = createEl('a', styles, text);
    el.href = href;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    return el;
  }

  function createFooterLink(prefix, linkText, href) {
    var p = createEl('p', {
      margin: '20px 0 0',
      fontSize: '13px',
      color: '#6b7280',
      lineHeight: '1.5',
    });
    p.appendChild(document.createTextNode(prefix + ' '));
    p.appendChild(
      createLink(href, linkText, {
        color: '#111827',
        fontWeight: '600',
        textDecoration: 'none',
      })
    );
    return p;
  }

  window.__sd = function () {
    if (window.__av || document.getElementById(OVERLAY_ID)) return;

    var t = typeof Theme !== 'undefined' && Theme.translations ? Theme.translations : {};
    var storeDomain = window.__te_d || '';

    var overlay = createEl('div', {
      position: 'fixed',
      inset: '0',
      background: 'rgba(15,23,42,0.45)',
      backdropFilter: 'blur(6px)',
      webkitBackdropFilter: 'blur(6px)',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: FONT_FAMILY,
    });
    overlay.id = OVERLAY_ID;

    var card = createEl('div', {
      background: '#fff',
      borderRadius: '24px',
      width: '100%',
      maxWidth: '440px',
      padding: '40px 36px 36px',
      boxShadow: '0 24px 48px rgba(15,23,42,0.12),0 8px 16px rgba(15,23,42,0.06)',
      textAlign: 'center',
      userSelect: 'text',
    });

    card.appendChild(
      createEl(
        'h2',
        {
          margin: '0 0 10px',
          fontSize: '22px',
          fontWeight: '700',
          color: '#111827',
          lineHeight: '1.3',
          letterSpacing: '-0.02em',
        },
        t.unlisted_heading || ''
      )
    );

    card.appendChild(
      createEl(
        'p',
        {
          margin: '0 0 28px',
          fontSize: '14px',
          lineHeight: '1.6',
          color: '#6b7280',
        },
        t.unlisted_message || ''
      )
    );

    var field = createEl('div', {
      textAlign: 'left',
      marginBottom: '24px',
    });

    var label = createEl(
      'label',
      {
        display: 'block',
        margin: '0 0 8px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#111827',
      },
      'Store domain'
    );
    label.htmlFor = 'te-activation-store-url';

    var inputWrap = createEl('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: '#f3f4f6',
      borderRadius: '14px',
      padding: '4px 4px 4px 16px',
      border: '1px solid transparent',
    });

    var input = createEl('input', {
      flex: '1',
      minWidth: '0',
      border: 'none',
      background: 'transparent',
      outline: 'none',
      fontSize: '14px',
      color: '#111827',
      padding: '12px 0',
      fontFamily: 'inherit',
    });
    input.id = 'te-activation-store-url';
    input.type = 'text';
    input.readOnly = true;
    input.value = storeDomain;
    input.onclick = function () {
      input.select();
    };

    var copyBtn = createEl('button', {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      border: 'none',
      borderRadius: '10px',
      background: 'transparent',
      color: '#9ca3af',
      cursor: 'pointer',
      flexShrink: '0',
    });
    copyBtn.type = 'button';
    copyBtn.title = t.copy_title || 'Copy';
    copyBtn.innerHTML = COPY_SVG;

    copyBtn.onmouseover = function () {
      if (copyBtn.dataset.ok) return;
      copyBtn.style.background = '#e5e7eb';
      copyBtn.style.color = '#374151';
    };
    copyBtn.onmouseout = function () {
      if (copyBtn.dataset.ok) return;
      copyBtn.style.background = 'transparent';
      copyBtn.style.color = '#9ca3af';
    };
    copyBtn.onclick = function () {
      input.focus();
      input.select();
      input.setSelectionRange(0, 9999);

      function showSuccess() {
        copyBtn.dataset.ok = '1';
        copyBtn.style.background = '#ecfdf5';
        copyBtn.style.color = '#059669';
        copyBtn.innerHTML = CHECK_SVG;
        copyBtn.title = 'Copied!';
        setTimeout(function () {
          delete copyBtn.dataset.ok;
          copyBtn.style.background = 'transparent';
          copyBtn.style.color = '#9ca3af';
          copyBtn.innerHTML = COPY_SVG;
          copyBtn.title = t.copy_title || 'Copy';
        }, 2000);
      }

      var copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (e) {}

      if (copied) showSuccess();
      else if (navigator.clipboard) navigator.clipboard.writeText(storeDomain).then(showSuccess).catch(showSuccess);
      else {
        copyBtn.title = 'Select text and press Ctrl+C';
        setTimeout(function () {
          copyBtn.title = t.copy_title || 'Copy';
        }, 2000);
      }
    };

    inputWrap.appendChild(input);
    inputWrap.appendChild(copyBtn);
    field.appendChild(label);
    field.appendChild(inputWrap);
    field.appendChild(
      createEl(
        'p',
        {
          margin: '8px 0 0',
          fontSize: '12px',
          color: '#9ca3af',
        },
        t.store_url_instruction || ''
      )
    );
    card.appendChild(field);

    card.appendChild(
      createLink(ACTIVATE_URL, t.l2 || 'Activate License', {
        display: 'block',
        width: '100%',
        padding: '16px 24px',
        borderRadius: '999px',
        background: '#111827',
        color: '#fff',
        fontSize: '15px',
        fontWeight: '600',
        fontFamily: 'inherit',
        cursor: 'pointer',
        textDecoration: 'none',
        lineHeight: '1.2',
        boxSizing: 'border-box',
      })
    );

    if (t.unlisted_already_msg) {
      var alreadyP = createEl('p', {
        margin: '20px 0 0',
        fontSize: '13px',
        color: '#6b7280',
        lineHeight: '1.5',
      });
      alreadyP.appendChild(document.createTextNode(t.unlisted_already_msg + ' '));
      alreadyP.appendChild(
        createLink(ACTIVATE_URL, t.l2 || 'Activate License', {
          color: '#111827',
          fontWeight: '600',
          textDecoration: 'none',
        })
      );
      card.appendChild(alreadyP);
    }

    card.appendChild(createFooterLink('Not have license key?', t.l1 || 'Buy License', PURCHASE_URL));

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  };
})();
