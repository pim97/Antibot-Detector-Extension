/**
 * Scrappey Bot Detector - Content Script (ISOLATED World)
 * Collects page data and coordinates with background script
 */

// Prevent duplicate initialization
if (!window.__scrappeyContentInitialized) {
  window.__scrappeyContentInitialized = true;
  
  // Global state
  let hasCollectedData = false;
  
  /**
   * Check if extension context is valid
   */
  function isContextValid() {
    try {
      return !!(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }
  
  /**
   * Check if URL is valid for scanning
   */
  function isValidUrl(url) {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  }
  
  /**
   * Parse document.cookie into array of {name, value} objects
   */
  function parseCookies() {
    const cookies = [];
    try {
      const cookieString = document.cookie || '';
      if (cookieString) {
        const pairs = cookieString.split(';');
        for (const pair of pairs) {
          const [name, ...valueParts] = pair.trim().split('=');
          if (name) {
            cookies.push({
              name: name.trim(),
              value: valueParts.join('=') || ''
            });
          }
        }
      }
    } catch (error) {
      console.error('[Scrappey] Error parsing cookies:', error);
    }
    return cookies;
  }
  
  /**
   * Collect page data for detection
   */
  async function collectPageData() {
    const data = {
      url: window.location.href,
      html: '',
      scripts: [],
      cookies: parseCookies(), // Parse cookies from document.cookie
      dom: { selectors: [] },
      windowProps: [],
      jsHooks: []
    };
    
    try {
      // Collect HTML (limited for performance)
      data.html = document.documentElement?.outerHTML?.slice(0, 100000) || '';
      
      // Collect script sources
      const scripts = document.querySelectorAll('script[src]');
      data.scripts = Array.from(scripts).map(s => s.src).filter(Boolean);
      
      // Collect inline script content
      const inlineScripts = document.querySelectorAll('script:not([src])');
      for (const script of inlineScripts) {
        if (script.textContent) {
          data.html += '\n' + script.textContent;
        }
      }
      
      // Check common detection selectors
      const selectorsToCheck = [
        // reCAPTCHA
        '.g-recaptcha',
        '[data-sitekey]',
        'iframe[src*="recaptcha"]',
        '#recaptcha',
        // hCaptcha
        '.h-captcha',
        'iframe[src*="hcaptcha"]',
        // Cloudflare
        '.cf-turnstile',
        '#challenge-form',
        '#cf-wrapper',
        '[data-cf-turnstile-sitekey]',
        // DataDome
        '.datadome-captcha',
        '#datadome-captcha',
        // General
        '.captcha-container',
        '.captcha',
        '[data-callback]',
        // PerimeterX
        '#px-captcha',
        // FunCaptcha
        '#funcaptcha',
        '.funcaptcha',
        // GeeTest
        '.geetest_holder',
        '#geetest-wrap'
      ];
      
      for (const selector of selectorsToCheck) {
        try {
          if (document.querySelector(selector)) {
            data.dom.selectors.push(selector);
          }
        } catch {
          // Invalid selector, skip
        }
      }
      
      // Collect window props from MAIN world (if available)
      if (window.__scrappeyWindowProps) {
        data.windowProps = window.__scrappeyWindowProps;
      }
      
      // Collect JS hooks from MAIN world (if available)
      if (window.__scrappeyJsHooks) {
        data.jsHooks = window.__scrappeyJsHooks;
      }
      
    } catch (error) {
      console.error('[Scrappey] Error collecting page data:', error);
    }
    
    return data;
  }
  
  /**
   * Send page data to background script
   */
  async function sendPageData(force = false) {
    if (!isContextValid()) return;
    if (hasCollectedData && !force) return;
    
    hasCollectedData = true;
    
    try {
      const data = await collectPageData();
      
      const response = await chrome.runtime.sendMessage({
        type: 'PAGE_DATA',
        data: data
      });
      
      console.log('[Scrappey] Page data sent to background, detections:', response?.detections?.length || 0);
      
    } catch (error) {
      console.error('[Scrappey] Error sending page data:', error);
      hasCollectedData = false; // Allow retry
    }
  }
  
  /**
   * Notify background about page load and run detection
   */
  async function notifyPageLoad() {
    if (!isContextValid()) return;
    
    console.log('[Scrappey] Page load detected, running detection...');
    
    // Always collect and send page data on load (force = true to bypass cache check)
    sendPageData(true);
  }
  
  /**
   * Listen for messages from background
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isContextValid()) return false;
    
    switch (message.type) {
      case 'PING':
        // Used to check if content script is already injected
        sendResponse({ pong: true });
        return true;
        
      case 'REQUEST_PAGE_DATA':
        sendPageData(true).then(() => {
          sendResponse({ success: true });
        });
        return true;
        
      case 'RUN_DETECTION':
        sendPageData(true).then(() => {
          sendResponse({ success: true });
        });
        return true;
    }
    
    return false;
  });
  
  /**
   * Listen for messages from MAIN world
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    // JS Hook detection from MAIN world
    if (event.data?.type === 'SCRAPPEY_JS_HOOK') {
      if (!window.__scrappeyJsHooks) {
        window.__scrappeyJsHooks = [];
      }
      if (!window.__scrappeyJsHooks.includes(event.data.target)) {
        window.__scrappeyJsHooks.push(event.data.target);
        
        // Forward to background
        if (isContextValid()) {
          chrome.runtime.sendMessage({
            type: 'JS_HOOK_BATCH',
            hooks: [{ target: event.data.target }]
          }).catch(() => {});
        }
      }
    }
    
    // Window property detection from MAIN world
    if (event.data?.type === 'SCRAPPEY_WINDOW_PROP') {
      if (!window.__scrappeyWindowProps) {
        window.__scrappeyWindowProps = [];
      }
      if (!window.__scrappeyWindowProps.includes(event.data.path)) {
        window.__scrappeyWindowProps.push(event.data.path);
      }
    }
  });
  
  /**
   * Initialize on page load
   */
  function initialize() {
    if (!isValidUrl(window.location.href)) {
      return;
    }
    
    console.log('[Scrappey] Content script initialized');
    
    // Run detection when page is ready
    if (document.readyState === 'complete') {
      // Page already loaded, run immediately
      notifyPageLoad();
    } else if (document.readyState === 'interactive') {
      // DOM ready, run soon
      setTimeout(notifyPageLoad, 100);
    } else {
      // Wait for DOM to be ready
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(notifyPageLoad, 100);
      }, { once: true });
      
      // Also listen for full load as backup
      window.addEventListener('load', () => {
        // Re-scan after full load for dynamic content
        hasCollectedData = false;
        setTimeout(notifyPageLoad, 500);
      }, { once: true });
    }
  }
  
  // Start
  initialize();
}

