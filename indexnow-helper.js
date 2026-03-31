// ────────────────────────────────────────────────────────────────────────────
// IndexNow Helper - Notify search engines instantly when content updates
// ────────────────────────────────────────────────────────────────────────────

const INDEXNOW_CONFIG = {
  key: 'a7f3e9c2b8d1f4e5a6c7b9d2e3f1a4b5c6',
  keyLocation: 'https://parth-portfolio-wb.netlify.app/a7f3e9c2b8d1f4e5a6c7b9d2e3f1a4b5c6.txt',
  host: 'parth-portfolio-wb.netlify.app'
};

/**
 * Notify search engines about updated URLs using IndexNow protocol
 * @param {string|string[]} urls - Single URL or array of URLs to submit
 * @returns {Promise<Object>} Result of the notification
 */
async function notifyIndexNow(urls) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  
  const validUrls = urlList.filter(url => {
    try { new URL(url); return true; }
    catch { console.warn('Invalid URL:', url); return false; }
  });

  if (validUrls.length === 0) {
    return { success: false, error: 'No valid URLs to submit' };
  }

  const payload = {
    host: INDEXNOW_CONFIG.host,
    key: INDEXNOW_CONFIG.key,
    keyLocation: INDEXNOW_CONFIG.keyLocation,
    urlList: validUrls
  };

  try {
    const response = await fetch('/.netlify/functions/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (response.ok && (response.status === 200 || response.status === 202)) {
      console.log('✓ IndexNow notification sent successfully');
      return { success: true, urls: validUrls, status: response.status };
    } else {
      console.warn('IndexNow error:', result.message);
      return { success: false, error: result.message || `HTTP ${response.status}`, urls: validUrls };
    }
  } catch (error) {
    console.error('IndexNow notification failed:', error);
    return { success: false, error: error.message, urls: validUrls };
  }
}

/**
 * Notify search engines when the main page content updates
 * Call this after data is loaded or updated
 */
async function notifyContentUpdate() {
  const baseUrl = `https://${INDEXNOW_CONFIG.host}`;
  return await notifyIndexNow([baseUrl + '/']);
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { notifyIndexNow, notifyContentUpdate };
}