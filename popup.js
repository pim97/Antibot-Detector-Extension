/**
 * Scrappey Bot Detector - Popup Script
 * Unique spider-themed dashboard with Scrappey API integration
 */

// Global state
let currentDetections = [];
let isScanning = false;
let currentTabId = null;
let currentTabUrl = '';

// Scrappey API Configuration
const SCRAPPEY_API_BASE = 'https://publisher.scrappey.com/api/v1';
const SCRAPPEY_WEBSITE = 'https://scrappey.com';

/**
 * Initialize the popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Scrappey] Popup initialized');
  
  // Initialize UI elements
  initializeEventListeners();
  
  // Load settings
  await loadSettings();
  
  // Get current tab and load detections
  await loadCurrentTab();
  
  // Check Scrappey API status if key is configured
  await checkScrappeyBalance();
});

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Main toggle
  const enableToggle = document.getElementById('enableToggle');
  enableToggle?.addEventListener('change', handleToggleChange);
  
  // Settings panel
  document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
  document.getElementById('closeSettings')?.addEventListener('click', closeSettings);
  document.getElementById('settingsOverlay')?.addEventListener('click', closeSettings);
  
  // Action buttons
  document.getElementById('copyBtn')?.addEventListener('click', copyReport);
  document.getElementById('screenshotBtn')?.addEventListener('click', takeScreenshot);
  document.getElementById('rescanBtn')?.addEventListener('click', rescanPage);
  
  // Settings controls
  document.getElementById('cacheDuration')?.addEventListener('input', handleCacheDurationChange);
  document.getElementById('showFingerprinting')?.addEventListener('change', saveSettings);
  document.getElementById('clearCacheBtn')?.addEventListener('click', clearCache);
  
  // API Key
  document.getElementById('saveApiKey')?.addEventListener('click', saveApiKey);
  document.getElementById('checkBalance')?.addEventListener('click', checkScrappeyBalance);
}

/**
 * Load current tab information and detections
 */
async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    currentTabId = tab.id;
    currentTabUrl = tab.url;
    
    // Check if this is a valid web page
    if (!currentTabUrl || (!currentTabUrl.startsWith('http://') && !currentTabUrl.startsWith('https://'))) {
      updateTabInfo(tab);
      setMascotState('idle');
      updateStatus('Cannot scan this page');
      return;
    }
    
    // Update UI with tab info
    updateTabInfo(tab);
    
    // Start scanning animation
    setMascotState('scanning');
    updateStatus('Scanning...');
    
    // Load detections (content scripts are auto-injected via manifest)
    await loadDetectionsWithRetry();
    
  } catch (error) {
    console.error('[Scrappey] Error loading tab:', error);
    updateStatus('Error loading page');
  }
}

/**
 * Load detections with retry for fresh scan
 */
async function loadDetectionsWithRetry() {
  try {
    // First, check if we have cached detections
    let response = await chrome.runtime.sendMessage({
      type: 'GET_DETECTIONS',
      tabId: currentTabId,
      url: currentTabUrl
    });
    
    // If we have cached detections, display them
    if (response?.detections?.length > 0) {
      displayDetections(response.detections);
      return;
    }
    
    // No cached detections, request a scan
    await chrome.runtime.sendMessage({
      type: 'INJECT_AND_SCAN',
      tabId: currentTabId,
      url: currentTabUrl
    });
    
    // Wait for detection to complete
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Load detections again
    response = await chrome.runtime.sendMessage({
      type: 'GET_DETECTIONS',
      tabId: currentTabId,
      url: currentTabUrl
    });
    
    displayDetections(response?.detections || []);
    
  } catch (error) {
    console.error('[Scrappey] Error loading detections:', error);
    displayDetections([]);
  }
}

/**
 * Display detections in UI
 */
function displayDetections(detections) {
  currentDetections = detections;
  renderDetections(detections);
  updateStats(detections);
  
  if (detections.length > 0) {
    setMascotState('found');
    updateStatus(`Found ${detections.length} protection${detections.length > 1 ? 's' : ''}`);
  } else {
    setMascotState('idle');
    updateStatus('No protections detected');
  }
}

/**
 * Update tab information display
 */
function updateTabInfo(tab) {
  const faviconEl = document.getElementById('siteFavicon');
  const urlEl = document.getElementById('siteUrl');
  
  if (faviconEl && tab.favIconUrl) {
    faviconEl.src = tab.favIconUrl;
    faviconEl.style.display = 'block';
  } else if (faviconEl) {
    faviconEl.style.display = 'none';
  }
  
  if (urlEl) {
    try {
      const url = new URL(tab.url);
      urlEl.textContent = url.hostname + (url.pathname !== '/' ? url.pathname : '');
    } catch {
      urlEl.textContent = tab.url || 'Unknown';
    }
  }
}

/**
 * Load detections from background script
 */
async function loadDetections() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_DETECTIONS',
      tabId: currentTabId,
      url: currentTabUrl
    });
    
    if (response && response.detections) {
      currentDetections = response.detections;
      renderDetections(currentDetections);
      updateStats(currentDetections);
      
      if (currentDetections.length > 0) {
        setMascotState('found');
        updateStatus(`Found ${currentDetections.length} protection${currentDetections.length > 1 ? 's' : ''}`);
      } else {
        setMascotState('idle');
        updateStatus('No protections detected');
      }
    } else {
      setMascotState('idle');
      updateStatus('Ready to scan');
    }
    
  } catch (error) {
    console.error('[Scrappey] Error loading detections:', error);
    setMascotState('idle');
    updateStatus('Scan complete');
  }
}

/**
 * Update mascot state (idle, scanning, found)
 */
function setMascotState(state) {
  const mascot = document.getElementById('tealyMascot');
  const logo = document.getElementById('tealyLogo');
  
  if (!mascot) return;
  
  // Remove existing state classes
  mascot.classList.remove('scanning', 'found');
  
  // Set mascot image based on state
  switch (state) {
    case 'scanning':
      mascot.src = 'assets/tealy-scanning.svg';
      mascot.classList.add('scanning');
      break;
    case 'found':
      mascot.src = 'assets/tealy-found.svg';
      mascot.classList.add('found');
      break;
    default:
      mascot.src = 'assets/tealy-idle.svg';
  }
  
  // Update logo too
  if (logo) {
    logo.src = mascot.src;
  }
}

/**
 * Update status text
 */
function updateStatus(text) {
  const statusEl = document.querySelector('.status-text');
  if (statusEl) {
    statusEl.textContent = text;
  }
}

/**
 * Update statistics cards
 */
function updateStats(detections) {
  const stats = {
    antibot: 0,
    captcha: 0,
    fingerprint: 0
  };
  
  detections.forEach(d => {
    const category = (d.category || '').toLowerCase();
    if (category.includes('anti') || category.includes('bot')) {
      stats.antibot++;
    } else if (category.includes('captcha')) {
      stats.captcha++;
    } else if (category.includes('fingerprint')) {
      stats.fingerprint++;
    }
  });
  
  document.getElementById('antibotCount').textContent = stats.antibot;
  document.getElementById('captchaCount').textContent = stats.captcha;
  document.getElementById('fingerprintCount').textContent = stats.fingerprint;
  
  // Update status card
  const statusCard = document.getElementById('statusCard');
  const statusText = document.getElementById('statusText');
  const total = detections.length;
  
  statusCard.classList.remove('warning', 'danger');
  
  if (total === 0) {
    statusText.textContent = 'Clean';
    statusCard.classList.remove('warning', 'danger');
  } else if (total <= 2) {
    statusText.textContent = 'Low';
    statusCard.classList.add('warning');
  } else {
    statusText.textContent = 'High';
    statusCard.classList.add('danger');
  }
  
  // Update results count
  document.getElementById('resultsCount').textContent = `${total} found`;
}

/**
 * Render detection cards
 */
function renderDetections(detections) {
  const container = document.getElementById('resultsList');
  const emptyState = document.getElementById('emptyState');
  
  if (!container) return;
  
  // Clear existing cards (keep empty state)
  const existingCards = container.querySelectorAll('.detection-card');
  existingCards.forEach(card => card.remove());
  
  if (detections.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  detections.forEach(detection => {
    const card = createDetectionCard(detection);
    container.appendChild(card);
  });
}

/**
 * Format detection reasons into readable HTML
 */
function formatDetectionReasons(matches) {
  if (!matches || matches.length === 0) {
    return '<div class="reason-item">No specific triggers recorded</div>';
  }
  
  // Group matches by type for cleaner display
  const grouped = {};
  matches.forEach(match => {
    const type = match.type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(match);
  });
  
  // User-friendly type names and icons
  const typeInfo = {
    'cookie': { name: 'Cookie Found', icon: '🍪', description: 'A tracking cookie was detected' },
    'url': { name: 'Script Loaded', icon: '📜', description: 'A protection script was loaded' },
    'content': { name: 'Page Content', icon: '📄', description: 'Protection code found in page' },
    'dom': { name: 'Page Element', icon: '🔲', description: 'A CAPTCHA or challenge element exists' },
    'window': { name: 'Browser Variable', icon: '🌐', description: 'Protection variable detected in browser' },
    'js_hook': { name: 'API Monitoring', icon: '🎣', description: 'Browser API is being monitored' },
    'header': { name: 'HTTP Header', icon: '📨', description: 'Protection header detected' }
  };
  
  let html = '';
  
  for (const [type, typeMatches] of Object.entries(grouped)) {
    const info = typeInfo[type] || { name: type, icon: '🔍', description: 'Detection trigger' };
    
    typeMatches.forEach(match => {
      const rule = match.rule || match.description || 'Unknown trigger';
      const shortRule = rule.length > 50 ? rule.substring(0, 47) + '...' : rule;
      
      html += `
        <div class="reason-item">
          <span class="reason-icon">${info.icon}</span>
          <div class="reason-content">
            <span class="reason-type">${escapeHtml(info.name)}</span>
            <span class="reason-detail" title="${escapeHtml(rule)}">${escapeHtml(shortRule)}</span>
          </div>
        </div>
      `;
    });
  }
  
  return html;
}

/**
 * Get user-friendly explanation based on detection type
 */
function getDetectionExplanation(detection) {
  const id = (detection.id || '').toLowerCase();
  const name = (detection.name || '').toLowerCase();
  
  // Antibot explanations
  const explanations = {
    // Anti-bot systems
    'cloudflare': {
      what: 'Cloudflare Bot Protection',
      meaning: 'This website uses Cloudflare to block automated access. You may see "Checking your browser" pages.',
      impact: 'Automated scripts will be blocked unless they can mimic real browser behavior.'
    },
    'akamai': {
      what: 'Akamai Bot Manager',
      meaning: 'Enterprise-level bot detection that analyzes your browser fingerprint and behavior.',
      impact: 'Very difficult to bypass with simple automation tools.'
    },
    'datadome': {
      what: 'DataDome Protection',
      meaning: 'AI-powered bot detection that monitors mouse movements and browsing patterns.',
      impact: 'Blocks scrapers, credential stuffing, and account takeover attempts.'
    },
    'perimeterx': {
      what: 'PerimeterX/HUMAN Security',
      meaning: 'Advanced bot detection using behavioral analysis and machine learning.',
      impact: 'Detects and blocks automated browsers and headless tools.'
    },
    'kasada': {
      what: 'Kasada Protection',
      meaning: 'Military-grade bot protection with proof-of-work challenges.',
      impact: 'Extremely difficult to bypass, often used by high-security sites.'
    },
    'incapsula': {
      what: 'Imperva Incapsula',
      meaning: 'Cloud-based security that protects against bots and DDoS attacks.',
      impact: 'Blocks suspicious traffic patterns and known bot signatures.'
    },
    'shape': {
      what: 'Shape Security (F5)',
      meaning: 'Enterprise bot protection used by banks and major retailers.',
      impact: 'Uses advanced JavaScript challenges and device fingerprinting.'
    },
    
    // CAPTCHAs
    'recaptcha': {
      what: 'Google reCAPTCHA',
      meaning: 'Google\'s CAPTCHA system that may show image puzzles or run invisibly.',
      impact: 'Requires human interaction or CAPTCHA solving service to proceed.'
    },
    'hcaptcha': {
      what: 'hCaptcha',
      meaning: 'Privacy-focused CAPTCHA that shows image selection challenges.',
      impact: 'Similar to reCAPTCHA but rewards website owners for usage.'
    },
    'funcaptcha': {
      what: 'FunCaptcha (Arkose Labs)',
      meaning: 'Interactive puzzle CAPTCHA with rotating 3D images.',
      impact: 'Difficult to solve automatically, often used by social media sites.'
    },
    'geetest': {
      what: 'GeeTest CAPTCHA',
      meaning: 'Slider or click-based CAPTCHA popular in Asian markets.',
      impact: 'Requires completing a sliding puzzle or clicking specific areas.'
    },
    'turnstile': {
      what: 'Cloudflare Turnstile',
      meaning: 'Cloudflare\'s free, privacy-preserving CAPTCHA alternative.',
      impact: 'Usually runs invisibly but may show challenges for suspicious traffic.'
    },
    
    // Fingerprinting
    'canvas': {
      what: 'Canvas Fingerprinting',
      meaning: 'Tracks you by how your browser draws graphics. Each device creates a unique "fingerprint".',
      impact: 'Used to identify returning visitors even without cookies.'
    },
    'webgl': {
      what: 'WebGL Fingerprinting',
      meaning: 'Uses 3D graphics capabilities to identify your specific device.',
      impact: 'Reveals GPU model and driver information for tracking.'
    },
    'audio': {
      what: 'Audio Fingerprinting',
      meaning: 'Analyzes how your device processes sound to create a unique ID.',
      impact: 'Works even in incognito mode; hard to spoof.'
    },
    'font': {
      what: 'Font Fingerprinting',
      meaning: 'Detects which fonts are installed on your system.',
      impact: 'Different font combinations help identify unique devices.'
    },
    'navigator': {
      what: 'Navigator Fingerprinting',
      meaning: 'Collects browser settings like language, timezone, and screen size.',
      impact: 'Combined with other data, creates a unique browser identity.'
    },
    'screen': {
      what: 'Screen Fingerprinting',
      meaning: 'Records your screen resolution and display properties.',
      impact: 'Helps identify devices even when other identifiers are blocked.'
    },
    'webrtc': {
      what: 'WebRTC Leak Detection',
      meaning: 'Can reveal your real IP address even when using a VPN.',
      impact: 'Serious privacy concern for users trying to stay anonymous.'
    },
    'battery': {
      what: 'Battery API Access',
      meaning: 'Accesses your device battery level for tracking.',
      impact: 'Unique battery drain patterns can identify devices.'
    },
    'performance': {
      what: 'Performance Fingerprinting',
      meaning: 'Measures your device speed to create a unique profile.',
      impact: 'Different hardware performs tasks at different speeds.'
    },
    'media': {
      what: 'Media Device Fingerprinting',
      meaning: 'Lists your cameras and microphones for identification.',
      impact: 'Number and type of media devices help identify you.'
    },
    'geolocation': {
      what: 'Geolocation Tracking',
      meaning: 'Requests access to your physical location.',
      impact: 'Reveals where you are, even without GPS, using IP and network info.'
    },
    'storage': {
      what: 'Storage Fingerprinting',
      meaning: 'Uses browser storage to track you across sessions.',
      impact: 'Stores identifiers that persist even after clearing cookies.'
    },
    'timezone': {
      what: 'Timezone Detection',
      meaning: 'Records your timezone to help identify your location.',
      impact: 'Combined with language settings, narrows down your region.'
    },
    'hardware': {
      what: 'Hardware Fingerprinting',
      meaning: 'Detects CPU cores, memory size, and device capabilities.',
      impact: 'Unique hardware combinations identify specific devices.'
    }
  };
  
  // Find matching explanation
  for (const [key, info] of Object.entries(explanations)) {
    if (id.includes(key) || name.includes(key)) {
      return info;
    }
  }
  
  // Default explanation based on category
  const category = (detection.category || '').toLowerCase();
  if (category.includes('anti') || category.includes('bot')) {
    return {
      what: 'Bot Protection System',
      meaning: 'This website uses anti-bot technology to detect and block automated access.',
      impact: 'Automated tools may be blocked or challenged.'
    };
  } else if (category.includes('captcha')) {
    return {
      what: 'CAPTCHA Challenge',
      meaning: 'This website uses CAPTCHAs to verify that visitors are human.',
      impact: 'You may need to solve puzzles or click checkboxes to proceed.'
    };
  } else if (category.includes('fingerprint')) {
    return {
      what: 'Browser Fingerprinting',
      meaning: 'This website collects device information to identify and track visitors.',
      impact: 'Your device can be recognized even without cookies.'
    };
  }
  
  return {
    what: detection.name || 'Unknown Detection',
    meaning: detection.description || 'A protection mechanism was detected on this page.',
    impact: 'This may affect automated access or privacy.'
  };
}

/**
 * Create a detection card element
 */
function createDetectionCard(detection) {
  const card = document.createElement('div');
  const category = getCategoryClass(detection.category);
  card.className = `detection-card ${category}`;
  
  const confidence = detection.confidence || 0;
  const confidenceClass = confidence >= 80 ? 'high' : confidence >= 50 ? 'medium' : 'low';
  
  // Get icon path
  const iconPath = detection.icon 
    ? `detectors/icons/${detection.icon}` 
    : 'assets/tealy-idle.svg';
  
  // Get user-friendly explanation
  const explanation = getDetectionExplanation(detection);
  
  // Get top matches
  const matches = detection.matches || [];
  const displayMatches = matches.slice(0, 3);
  const moreCount = Math.max(0, matches.length - 3);
  
  // Format detection reasons (why it was detected)
  const detectionReasons = formatDetectionReasons(matches);
  
  card.innerHTML = `
    <div class="detection-header">
      <div class="detection-info">
        <div class="detection-icon">
          <img src="${iconPath}" alt="${detection.name}" onerror="this.src='assets/tealy-idle.svg'">
        </div>
        <div>
          <div class="detection-name">${escapeHtml(detection.name || 'Unknown')}</div>
          <div class="detection-category">${escapeHtml(detection.category || 'Detection')}</div>
        </div>
      </div>
      <div class="confidence-badge ${confidenceClass}">
        ${confidence}%
      </div>
    </div>
    
    <div class="detection-description">
      <div class="description-item">
        <span class="description-label">What is it?</span>
        <span class="description-text">${escapeHtml(explanation.what)}</span>
      </div>
      <div class="description-item">
        <span class="description-label">What does it mean?</span>
        <span class="description-text">${escapeHtml(explanation.meaning)}</span>
      </div>
      <div class="description-item">
        <span class="description-label">Impact</span>
        <span class="description-text">${escapeHtml(explanation.impact)}</span>
      </div>
    </div>
    
    <div class="detection-reasons">
      <div class="reasons-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>Why was this detected?</span>
      </div>
      <div class="reasons-list">
        ${detectionReasons}
      </div>
    </div>
    
    <div class="detection-footer">
      <div class="detection-matches">
        ${displayMatches.map(m => `<span class="match-tag">${escapeHtml(m.type || 'match')}</span>`).join('')}
        ${moreCount > 0 ? `<span class="match-tag">+${moreCount} more</span>` : ''}
      </div>
      <a href="${getScrappeyBypassUrl(detection)}" target="_blank" class="bypass-btn" title="Learn how to bypass with Scrappey">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
        Bypass
      </a>
    </div>
  `;
  
  return card;
}

/**
 * Get category CSS class
 */
function getCategoryClass(category) {
  if (!category) return '';
  const cat = category.toLowerCase();
  if (cat.includes('anti') || cat.includes('bot')) return 'antibot';
  if (cat.includes('captcha')) return 'captcha';
  if (cat.includes('fingerprint')) return 'fingerprint';
  return '';
}

/**
 * Get Scrappey bypass URL based on detection type
 */
function getScrappeyBypassUrl(detection) {
  const name = (detection.name || '').toLowerCase();
  const id = (detection.id || '').toLowerCase();
  
  // Map detection types to Scrappey documentation pages
  const bypassDocs = {
    'cloudflare': 'https://docs.scrappey.com/docs/welcome',
    'recaptcha': 'https://docs.scrappey.com/docs/welcome',
    'hcaptcha': 'https://docs.scrappey.com/docs/welcome',
    'datadome': 'https://docs.scrappey.com/docs/welcome',
    'akamai': 'https://docs.scrappey.com/docs/welcome',
    'perimeterx': 'https://docs.scrappey.com/docs/welcome',
    'incapsula': 'https://docs.scrappey.com/docs/welcome',
    'imperva': 'https://docs.scrappey.com/docs/welcome',
    'kasada': 'https://docs.scrappey.com/docs/welcome',
    'funcaptcha': 'https://docs.scrappey.com/docs/welcome',
    'geetest': 'https://docs.scrappey.com/docs/welcome'
  };
  
  // Find matching bypass doc
  for (const [key, url] of Object.entries(bypassDocs)) {
    if (name.includes(key) || id.includes(key)) {
      return url;
    }
  }
  
  // Default to main docs
  return 'https://docs.scrappey.com/docs/welcome';
}

/**
 * Rescan the current page
 */
async function rescanPage() {
  const btn = document.getElementById('rescanBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span><span>Scanning...</span>';
  }
  
  setMascotState('scanning');
  updateStatus('Rescanning...');
  
  try {
    // Send rescan message to background
    await chrome.runtime.sendMessage({
      type: 'RUN_DETECTION',
      tabId: currentTabId,
      url: currentTabUrl,
      force: true
    });
    
    // Wait a moment then reload detections
    setTimeout(async () => {
      await loadDetections();
      
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>Rescan</span>
        `;
      }
    }, 2000);
    
  } catch (error) {
    console.error('[Scrappey] Rescan error:', error);
    setMascotState('idle');
    updateStatus('Scan failed');
    
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        <span>Rescan</span>
      `;
    }
  }
}

/**
 * Copy detection report to clipboard
 */
async function copyReport() {
  const btn = document.getElementById('copyBtn');
  
  const report = generateReport();
  
  try {
    await navigator.clipboard.writeText(report);
    
    // Show success feedback
    if (btn) {
      btn.classList.add('copy-success');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>
      `;
      
      setTimeout(() => {
        btn.classList.remove('copy-success');
        btn.innerHTML = originalHtml;
      }, 2000);
    }
  } catch (error) {
    console.error('[Scrappey] Copy failed:', error);
  }
}

/**
 * Take a screenshot of the extension popup
 */
async function takeScreenshot() {
  const btn = document.getElementById('screenshotBtn');
  
  try {
    // Show loading state
    if (btn) {
      btn.disabled = true;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `
        <span class="loading-spinner"></span>
        <span>Capturing...</span>
      `;
      
      // Close settings panel if open
      closeSettings();
      
      // Wait a moment for UI to settle
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Capture the main app container
      const app = document.getElementById('app');
      if (!app) {
        throw new Error('App container not found');
      }
      
      let canvas;
      
      // Use html2canvas for high-quality capture
      if (checkHtml2Canvas()) {
        canvas = await html2canvas(app, {
          backgroundColor: '#0C1222',
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: false,
          width: app.scrollWidth,
          height: app.scrollHeight,
          windowWidth: app.scrollWidth,
          windowHeight: app.scrollHeight
        });
      } else {
        // Fallback: Use ScreenshotHelper (basic canvas)
        canvas = await ScreenshotHelper.captureElement(app, {
          backgroundColor: '#0C1222',
          scale: 2
        });
      }
      
      // Generate filename with URL and timestamp
      const urlObj = new URL(currentTabUrl || 'unknown');
      const hostname = urlObj.hostname.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `scrappey-detections_${hostname}_${timestamp}.png`;
      
      // Download the image
      ScreenshotHelper.downloadCanvas(canvas, filename);
      
      // Show success feedback
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Saved!</span>
      `;
      btn.classList.add('copy-success');
      
      setTimeout(() => {
        btn.disabled = false;
        btn.classList.remove('copy-success');
        btn.innerHTML = originalHtml;
      }, 2000);
      
    }
  } catch (error) {
    console.error('[Scrappey] Screenshot failed:', error);
    
    if (btn) {
      btn.disabled = false;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span>Failed</span>
      `;
      setTimeout(() => {
        btn.innerHTML = originalHtml;
      }, 2000);
    }
  }
}

/**
 * Check if html2canvas is loaded
 */
function checkHtml2Canvas() {
  if (typeof html2canvas === 'undefined') {
    console.warn('[Scrappey] html2canvas not loaded, screenshot may have limited functionality');
    return false;
  }
  return true;
}

/**
 * Generate a text report of detections
 */
function generateReport() {
  const lines = [
    '# Scrappey Bot Detector Report',
    `URL: ${currentTabUrl}`,
    `Date: ${new Date().toISOString()}`,
    `Total Detections: ${currentDetections.length}`,
    ''
  ];
  
  if (currentDetections.length === 0) {
    lines.push('No protections detected on this page.');
  } else {
    lines.push('## Detected Protections\n');
    
    currentDetections.forEach((d, i) => {
      lines.push(`### ${i + 1}. ${d.name}`);
      lines.push(`- Category: ${d.category}`);
      lines.push(`- Confidence: ${d.confidence}%`);
      if (d.matches && d.matches.length > 0) {
        lines.push(`- Matches: ${d.matches.map(m => m.type || m.description).join(', ')}`);
      }
      lines.push('');
    });
    
    lines.push('---');
    lines.push('Bypass these protections with Scrappey: https://scrappey.com');
  }
  
  return lines.join('\n');
}

/**
 * Settings Panel Functions
 */
function openSettings() {
  document.getElementById('settingsPanel')?.classList.add('active');
  document.getElementById('settingsOverlay')?.classList.add('active');
}

function closeSettings() {
  document.getElementById('settingsPanel')?.classList.remove('active');
  document.getElementById('settingsOverlay')?.classList.remove('active');
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([
      'scrappey_enabled',
      'scrappey_cache_duration',
      'scrappey_show_fingerprinting',
      'scrappey_api_key'
    ]);
    
    // Apply settings to UI
    const enableToggle = document.getElementById('enableToggle');
    if (enableToggle) {
      enableToggle.checked = result.scrappey_enabled !== false;
    }
    
    const cacheDuration = document.getElementById('cacheDuration');
    const cacheValue = document.getElementById('cacheDurationValue');
    if (cacheDuration && cacheValue) {
      const duration = result.scrappey_cache_duration || 12;
      cacheDuration.value = duration;
      cacheValue.textContent = `${duration}h`;
    }
    
    const showFingerprinting = document.getElementById('showFingerprinting');
    if (showFingerprinting) {
      showFingerprinting.checked = result.scrappey_show_fingerprinting !== false;
    }
    
    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput && result.scrappey_api_key) {
      apiKeyInput.value = result.scrappey_api_key;
    }
    
  } catch (error) {
    console.error('[Scrappey] Error loading settings:', error);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({
      scrappey_show_fingerprinting: document.getElementById('showFingerprinting')?.checked ?? true,
      scrappey_cache_duration: parseInt(document.getElementById('cacheDuration')?.value || '12')
    });
  } catch (error) {
    console.error('[Scrappey] Error saving settings:', error);
  }
}

function handleCacheDurationChange(e) {
  const value = e.target.value;
  document.getElementById('cacheDurationValue').textContent = `${value}h`;
  saveSettings();
}

async function handleToggleChange(e) {
  const enabled = e.target.checked;
  
  try {
    await chrome.storage.local.set({ scrappey_enabled: enabled });
    
    // Notify background script
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_EXTENSION',
      enabled: enabled
    });
    
    if (enabled) {
      setMascotState('idle');
      updateStatus('Ready to scan');
    } else {
      setMascotState('idle');
      updateStatus('Disabled');
    }
  } catch (error) {
    console.error('[Scrappey] Error toggling extension:', error);
  }
}

async function clearCache() {
  const btn = document.getElementById('clearCacheBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Clearing...';
  }
  
  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
    
    // Reset UI
    currentDetections = [];
    renderDetections([]);
    updateStats([]);
    setMascotState('idle');
    updateStatus('Cache cleared');
    
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Cleared!
      `;
      
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Clear Cache
        `;
      }, 2000);
    }
  } catch (error) {
    console.error('[Scrappey] Error clearing cache:', error);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Clear Cache';
    }
  }
}

/**
 * Scrappey API Functions
 */
async function saveApiKey() {
  const input = document.getElementById('apiKeyInput');
  const btn = document.getElementById('saveApiKey');
  
  if (!input || !btn) return;
  
  const apiKey = input.value.trim();
  
  if (!apiKey) {
    showApiStatus('Please enter an API key', 'error');
    return;
  }
  
  btn.disabled = true;
  btn.textContent = 'Saving...';
  
  try {
    await chrome.storage.local.set({ scrappey_api_key: apiKey });
    
    btn.textContent = 'Saved!';
    showApiStatus('API key saved successfully', 'success');
    
    // Check balance with new key
    await checkScrappeyBalance();
    
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Save';
    }, 2000);
    
  } catch (error) {
    console.error('[Scrappey] Error saving API key:', error);
    btn.disabled = false;
    btn.textContent = 'Save';
    showApiStatus('Failed to save API key', 'error');
  }
}

async function checkScrappeyBalance() {
  const balanceEl = document.getElementById('apiBalance');
  const statusEl = document.getElementById('apiStatus');
  
  try {
    const result = await chrome.storage.local.get(['scrappey_api_key']);
    const apiKey = result.scrappey_api_key;
    
    if (!apiKey) {
      if (balanceEl) balanceEl.textContent = '--';
      if (statusEl) {
        statusEl.textContent = 'No API key configured';
        statusEl.className = 'api-status muted';
      }
      return;
    }
    
    if (balanceEl) balanceEl.textContent = '...';
    if (statusEl) {
      statusEl.textContent = 'Checking...';
      statusEl.className = 'api-status';
    }
    
    // Call Scrappey API to check balance (GET request)
    const response = await fetch(`${SCRAPPEY_API_BASE}/balance?key=${encodeURIComponent(apiKey)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    const data = await response.json();
    
    if (data.error) {
      if (balanceEl) balanceEl.textContent = '--';
      showApiStatus(data.error, 'error');
    } else if (data.balance !== undefined) {
      if (balanceEl) balanceEl.textContent = `${data.balance} credits`;
      showApiStatus('Connected', 'success');
    } else if (data.credits !== undefined) {
      if (balanceEl) balanceEl.textContent = `${data.credits} credits`;
      showApiStatus('Connected', 'success');
    } else if (data.remaining !== undefined) {
      if (balanceEl) balanceEl.textContent = `${data.remaining} remaining`;
      showApiStatus('Connected', 'success');
    } else {
      // API responded - check for success indicator
      if (balanceEl) balanceEl.textContent = 'Active';
      showApiStatus('API key valid', 'success');
    }
    
  } catch (error) {
    console.error('[Scrappey] Error checking balance:', error);
    if (balanceEl) balanceEl.textContent = '--';
    showApiStatus('Could not connect to API', 'error');
  }
}

function showApiStatus(message, type) {
  const statusEl = document.getElementById('apiStatus');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `api-status ${type || ''}`;
  }
}

/**
 * Utility Functions
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DETECTION_UPDATE') {
    // Reload detections when background reports updates
    loadDetections();
  }
  return true;
});

