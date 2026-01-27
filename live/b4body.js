(function() {
  'use strict';
  
  const DEBUG = new URLSearchParams(window.location.search).get('msk_debug') === '1';
  
  const log = {
    info: (...args) => DEBUG && console.log('🔵 [MSK]', ...args),
    success: (...args) => DEBUG && console.log('✅ [MSK]', ...args),
    warn: (...args) => DEBUG && console.warn('⚠️ [MSK]', ...args),
    error: (...args) => DEBUG && console.error('❌ [MSK]', ...args),
    time: (label) => DEBUG && console.time(`⏱️ [MSK] ${label}`),
    timeEnd: (label) => DEBUG && console.timeEnd(`⏱️ [MSK] ${label}`),
    table: (data) => DEBUG && console.table(data),
    group: (label) => DEBUG && console.group(`📦 [MSK] ${label}`),
    groupEnd: () => DEBUG && console.groupEnd()
  };
  
  if (DEBUG) {
    console.log('%c🟢 MySellKit LIVE Mode', 'background: #16a34a; color: white; padding: 8px 16px; border-radius: 4px; font-size: 14px; font-weight: bold;');
  }
  
  const CONFIG = {
    API_BASE: 'https://app.mysellkit.com/api/1.1/wf',
    STRIPE_KEY: 'pk_live_51SC1A2BiFovi3utDiJvoI9tDoCSGAgaLISxZdRjXaUfdEQeTCTKd9MfohJpFWzwVIXxVFerfZO6i6DYcJovcxejh00vQOqsY1p',
    DOWNLOAD_URL: 'https://app.mysellkit.com/download',
    SESSION_DURATION: 14400000,
    SESSION_STORAGE_PREFIX: 'msk_session_',
    SESSION_TIME_PREFIX: 'msk_session_time_',
    PURCHASE_FLAG_PREFIX: 'msk_purchase_done_',
    SETTINGS_URL_BASE: 'https://app.mysellkit.com/?v=settings&product='
  };
  
  const PAGE_LOAD_TIME = (function() {
    try {
      if (performance.timeOrigin && performance.now) {
        const loadTime = Math.round(performance.now());
        log.info('Page load time (script execution):', loadTime + 'ms');
        return loadTime;
      }
      if (performance.timing && performance.timing.navigationStart) {
        const loadTime = Math.round(Date.now() - performance.timing.navigationStart);
        log.info('Page load time (fallback):', loadTime + 'ms');
        return loadTime;
      }
    } catch (e) {
      log.warn('Could not get page load time:', e);
    }
    return 0;
  })();
  
  window.MySellKit = {
    stripe: null,
    checkout: null,
    actions: null,
    productId: null,
    sessionId: null,
    purchaseToken: null,
    clientSecret: null,
    amount: null,
    currency: null,
    priceBefore: null,
    productName: null,
    sellerName: null,
    sellerAvatar: null,
    stripeAccountReady: true,
    tracking: {
      scriptStartTime: performance.now(),
      checkoutReadyTime: null,
      userIP: null,
      trackingSent: false,
      pageLoadTime: PAGE_LOAD_TIME
    }
  };
  
  function parseUserAgent() {
    const ua = navigator.userAgent;
    
    let deviceType = 'Desktop';
    if (/Mobi|Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      deviceType = 'Mobile';
    } else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) {
      deviceType = 'Tablet';
    }
    
    let os = 'Other';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      os = 'iOS';
    } else if (/Android/i.test(ua)) {
      os = 'Android';
    } else if (/Windows/i.test(ua)) {
      os = 'Windows';
    } else if (/Mac OS X|macOS/i.test(ua)) {
      os = 'macOS';
    } else if (/Linux/i.test(ua)) {
      os = 'Linux';
    } else if (/CrOS/i.test(ua)) {
      os = 'ChromeOS';
    }
    
    let browser = 'Other';
    if (/Edg\//i.test(ua)) {
      browser = 'Edge';
    } else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
      browser = 'Chrome';
    } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
      browser = 'Safari';
    } else if (/Firefox/i.test(ua)) {
      browser = 'Firefox';
    } else if (/Opera|OPR/i.test(ua)) {
      browser = 'Opera';
    } else if (/MSIE|Trident/i.test(ua)) {
      browser = 'Internet Explorer';
    }
    
    return { deviceType, os, browser };
  }
  
  function getSessionStorageKey(productId) {
    return CONFIG.SESSION_STORAGE_PREFIX + productId;
  }
  
  function getSessionTimeKey(productId) {
    return CONFIG.SESSION_TIME_PREFIX + productId;
  }
  
  function getPurchaseFlagKey(productId) {
    return CONFIG.PURCHASE_FLAG_PREFIX + productId;
  }
  
  function getSessionId(productId) {
    log.group('Session Management');
    log.info('Product ID:', productId);
    
    const sessionKey = getSessionStorageKey(productId);
    const timeKey = getSessionTimeKey(productId);
    const purchaseKey = getPurchaseFlagKey(productId);
    
    const purchaseDone = localStorage.getItem(purchaseKey);
    if (purchaseDone) {
      log.info('Previous purchase detected for this product, clearing session');
      localStorage.removeItem(purchaseKey);
      localStorage.removeItem(sessionKey);
      localStorage.removeItem(timeKey);
    }
    
    const stored = localStorage.getItem(sessionKey);
    const storedTime = localStorage.getItem(timeKey);
    const now = Date.now();
    
    if (stored && storedTime && (now - parseInt(storedTime) < CONFIG.SESSION_DURATION)) {
      const remainingMs = CONFIG.SESSION_DURATION - (now - parseInt(storedTime));
      const remainingMin = Math.round(remainingMs / 60000);
      log.info('Existing session found:', stored);
      log.info('Session expires in:', remainingMin + ' minutes');
      localStorage.setItem(timeKey, now.toString());
      log.groupEnd();
      return stored;
    }
    
    const newSession = 'msk_' + productId + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(sessionKey, newSession);
    localStorage.setItem(timeKey, now.toString());
    log.info('New session created:', newSession);
    log.groupEnd();
    return newSession;
  }
  
  function markPurchaseComplete() {
    const productId = window.MySellKit.productId;
    if (productId) {
      const purchaseKey = getPurchaseFlagKey(productId);
      localStorage.setItem(purchaseKey, 'true');
      log.success('Purchase marked as complete for product:', productId);
    }
  }
  
  window.MySellKit.markPurchaseComplete = markPurchaseComplete;
  
  function generatePurchaseToken() {
    // Generate alphanumeric token without prefix or underscores
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 12);
  }
  
  async function getUserIP() {
    log.time('Fetch IP');
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      log.timeEnd('Fetch IP');
      log.info('User IP:', data.ip);
      return data.ip;
    } catch (error) {
      log.timeEnd('Fetch IP');
      log.warn('Could not fetch IP:', error.message);
      return "";
    }
  }
  
  function getTrackingData() {
    const checkoutLoadTime = window.MySellKit.tracking.checkoutReadyTime 
      ? Math.round(window.MySellKit.tracking.checkoutReadyTime - window.MySellKit.tracking.scriptStartTime)
      : 0;
    
    const { deviceType, os, browser } = parseUserAgent();
    
    return {
      session_id: window.MySellKit.sessionId,
      product_id: window.MySellKit.productId,
      page_load_time: window.MySellKit.tracking.pageLoadTime || 0,
      checkout_load_time: checkoutLoadTime,
      device_type: deviceType,
      os: os,
      browser: browser,
      page_url: window.location.href,
      referrer: document.referrer || "",
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      user_ip: window.MySellKit.tracking.userIP || ""
    };
  }
  
  async function sendTracking() {
    if (window.MySellKit.tracking.trackingSent) {
      log.info('Tracking already sent, skipping');
      return;
    }
    
    const trackingData = getTrackingData();
    
    log.group('Tracking Data');
    log.table(trackingData);
    log.groupEnd();
    
    log.time('Send Tracking API');
    try {
      const response = await fetch(`${CONFIG.API_BASE}/track-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingData)
      });
      
      log.timeEnd('Send Tracking API');
      
      if (response.ok) {
        log.success('Tracking sent successfully');
      } else {
        log.warn('Tracking API returned status:', response.status);
      }
      
      window.MySellKit.tracking.trackingSent = true;
    } catch (error) {
      log.timeEnd('Send Tracking API');
      log.error('Tracking error:', error.message);
    }
  }
  
  function getProductIdFromURL() {
    const pathParts = window.location.pathname.split('/').filter(p => p);
    const pIndex = pathParts.indexOf('p');
    if (pIndex !== -1 && pathParts[pIndex + 1]) {
      const slug = pathParts[pIndex + 1];
      // Extrait l'ID (6 derniers caractères si préfixé par test-)
      const id = slug.replace(/^test-/, '');
      if (/^[a-z0-9]{5,8}$/.test(id)) {
        log.info('Product ID from URL:', id);
        return id;
      }
    }
    log.warn('No valid product ID found in URL');
    return null;
  }
  
  function formatAmount(amount, currency) {
    const symbols = { 'eur': '€', 'usd': '$', 'gbp': '£', 'chf': 'CHF ', 'cad': 'CA$', 'aud': 'A$', 'jpy': '¥' };
    const symbol = symbols[currency?.toLowerCase()] || currency?.toUpperCase() + ' ';
    const num = parseFloat(amount);
    return symbol + (num % 1 === 0 ? num.toFixed(0) : num.toFixed(2));
  }
  
  async function createCheckoutSession() {
    log.group('Create Checkout Session');
    log.info('Product ID:', window.MySellKit.productId);
    log.info('Session ID:', window.MySellKit.sessionId);
    log.info('Purchase Token:', window.MySellKit.purchaseToken);
    log.time('Checkout Session API');
    
    const response = await fetch(`${CONFIG.API_BASE}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: window.MySellKit.productId,
        session_id: window.MySellKit.sessionId,
        purchase_token: window.MySellKit.purchaseToken
      })
    });
    
    log.timeEnd('Checkout Session API');
    
    const data = await response.json();
    if (!data.response || !data.response.clientSecret) {
      log.error('Invalid API response:', data);
      log.groupEnd();
      throw new Error('Invalid API response');
    }
    
    log.success('Checkout session created');
    log.info('Amount:', data.response.amount, data.response.currency);
    log.info('Product:', data.response.product_name);
    log.info('Seller:', data.response.seller_name);
    log.info('Seller Avatar:', data.response.seller_avatar || 'None');
    log.info('Stripe Account Ready:', data.response.stripe_account_ready);
    if (data.response.stripeAccount) {
      log.info('Connected Account:', data.response.stripeAccount);
    }
    log.groupEnd();
    
    return data.response;
  }
  
  async function initializeStripe(paymentData) {
    log.group('Initialize Stripe');
    log.time('Stripe Init');

    const { clientSecret, amount, currency, price_before, product_name, seller_name, seller_avatar, stripeAccount, stripe_account_ready } = paymentData;
    
    window.MySellKit.stripeAccountReady = stripe_account_ready !== false;
    
    if (stripe_account_ready === false) {
      log.warn('Stripe account not ready, stopping checkout initialization');
      log.timeEnd('Stripe Init');
      log.groupEnd();
      
      window.MySellKit.sellerName = seller_name;
      
      window.dispatchEvent(new CustomEvent('mysellkit:stripe-not-ready', {
        detail: {
          sellerName: seller_name,
          settingsUrl: CONFIG.SETTINGS_URL_BASE + window.MySellKit.productId
        }
      }));
      return;
    }
    
    const stripeOptions = stripeAccount ? { stripeAccount } : {};
    log.info('Stripe options:', stripeOptions);
    
    window.MySellKit.stripe = Stripe(CONFIG.STRIPE_KEY, stripeOptions);
    log.success('Stripe.js initialized');
    
    const appearance = {
      theme: 'stripe',
      inputs: 'condensed',
      labels: 'above',
      variables: {
        fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontWeightNormal: '400',
        fontWeightMedium: '500',
        fontWeightBold: '600',
        borderRadius: '12px',
        colorPrimary: '#0570de',
        colorText: '#1a1a1a',
        colorTextSecondary: '#6b7280',
        colorBackground: '#ffffff',
        colorDanger: '#df1b41',
        spacingUnit: '4px',
        spacingGridRow: '16px'
      },
      rules: {
        '.Label': {
          fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
          fontWeight: '500',
          color: '#1a1a1a',
          marginBottom: '8px'
        },
        '.Input': {
          fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid #e6e6e6',
          boxShadow: '0 1px 1px 0 rgba(0, 0, 0, 0.07)'
        },
        '.Input:focus': {
          borderColor: '#0570de',
          boxShadow: '0 0 0 1px #0570de, 0 1px 1px 0 rgba(0, 0, 0, 0.07), 0 0 0 4px rgba(5, 112, 222, 0.1)'
        },
        '.Input--invalid': {
          borderColor: '#df1b41'
        },
        '.Error': {
          fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '13px',
          color: '#df1b41'
        },
        '.Tab': {
          fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        '.TabLabel': {
          fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        '.Block': {
          fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      }
    };
    
    const fonts = [
      {
        cssSrc: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap'
      }
    ];
    
    window.MySellKit.checkout = await window.MySellKit.stripe.initCheckout({
      clientSecret,
      elementsOptions: { appearance, fonts, loader: 'auto' }
    });
    log.success('Checkout initialized');
    
    log.time('Load Actions');
    const actionsResult = await window.MySellKit.checkout.loadActions();
    log.timeEnd('Load Actions');
    
    if (actionsResult.type === 'success') {
      window.MySellKit.actions = actionsResult.actions;
      log.success('Actions loaded');
    } else {
      log.error('Failed to load actions:', actionsResult);
    }
    
    window.MySellKit.amount = formatAmount(amount, currency);
    window.MySellKit.currency = currency;
    window.MySellKit.priceBefore = price_before ? formatAmount(price_before, currency) : null;
    window.MySellKit.productName = product_name;
    window.MySellKit.sellerName = seller_name;
    window.MySellKit.sellerAvatar = seller_avatar || null;
    
    log.timeEnd('Stripe Init');
    log.groupEnd();
    
    log.success('Dispatching mysellkit:ready event');
    window.dispatchEvent(new CustomEvent('mysellkit:ready', {
      detail: {
        amount: window.MySellKit.amount,
        currency,
        priceBefore: window.MySellKit.priceBefore,
        productName: product_name,
        sellerName: seller_name,
        sellerAvatar: window.MySellKit.sellerAvatar
      }
    }));
  }
  
  window.MySellKit.confirmPayment = async function(email) {
    log.group('Confirm Payment');
    log.info('Email:', email);
    
    if (!window.MySellKit.actions) {
      log.error('Checkout not ready');
      log.groupEnd();
      return { error: { message: 'Checkout not ready' } };
    }
    try {
      if (email) {
        log.time('Update Email');
        const emailResult = await window.MySellKit.actions.updateEmail(email);
        log.timeEnd('Update Email');
        if (emailResult.type === 'error') {
          log.error('Email update failed:', emailResult.error.message);
          log.groupEnd();
          return { error: { message: emailResult.error.message } };
        }
        log.success('Email updated');
      }
      
      log.time('Confirm Payment');
      const result = await window.MySellKit.actions.confirm();
      log.timeEnd('Confirm Payment');
      
      if (result.type === 'error') {
        log.error('Payment failed:', result.error.message);
        log.groupEnd();
        return { error: { message: result.error.message } };
      }
      
      markPurchaseComplete();
      
      log.success('Payment confirmed!');
      log.groupEnd();
      return { error: null };
    } catch (error) {
      log.error('Payment exception:', error.message);
      log.groupEnd();
      return { error: { message: error.message } };
    }
  };
  
  window.MySellKit.updateEmail = async function(email) {
    if (!window.MySellKit.actions) {
      log.warn('Cannot update email - actions not ready');
      return { type: 'error', error: { message: 'Not ready' } };
    }
    log.info('Updating email:', email);
    return await window.MySellKit.actions.updateEmail(email);
  };
  
  window.MySellKit.onCheckoutReady = function() {
    window.MySellKit.tracking.checkoutReadyTime = performance.now();
    const totalTime = Math.round(window.MySellKit.tracking.checkoutReadyTime - window.MySellKit.tracking.scriptStartTime);
    log.success('Checkout fully ready in', totalTime + 'ms');
    
    setTimeout(() => {
      sendTracking();
    }, 100);
  };
  
  async function init() {
    log.group('Initialization');
    log.time('Total Init');
    
    window.MySellKit.productId = getProductIdFromURL();
    if (!window.MySellKit.productId) {
      log.warn('No product ID found, aborting init');
      log.groupEnd();
      return;
    }
    
    window.MySellKit.sessionId = getSessionId(window.MySellKit.productId);
    window.MySellKit.purchaseToken = generatePurchaseToken();
    log.info('Purchase Token:', window.MySellKit.purchaseToken);
    
    getUserIP().then(ip => {
      window.MySellKit.tracking.userIP = ip;
    });
    
    try {
      const paymentData = await createCheckoutSession();
      await initializeStripe(paymentData);
      log.timeEnd('Total Init');
      log.groupEnd();
    } catch (error) {
      log.timeEnd('Total Init');
      log.error('Init error:', error.message);
      log.groupEnd();
      window.dispatchEvent(new CustomEvent('mysellkit:error', { detail: { error: error.message } }));
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
