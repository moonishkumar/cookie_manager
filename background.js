/**
 * Background script pour Cookie Manager
 */

// Ouvrir la sidebar quand on clique sur l'icône
browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.toggle();
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'importCookies') {
    importCookies(message.cookies)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function importCookies(cookies) {
  let imported = 0;
  let failed = 0;
  const errors = [];

  for (const cookie of cookies) {
    try {
      // Skip invalid cookies
      if (!cookie.name || !cookie.domain) {
        failed++;
        continue;
      }

      // Clean domain
      let domain = cookie.domain;
      if (domain.startsWith('.')) {
        domain = domain.substring(1);
      }

      // Build URL - always use https for secure cookies
      const protocol = cookie.secure ? 'https://' : 'http://';
      const url = protocol + domain + (cookie.path || '/');

      // Normalize sameSite
      let sameSite = 'no_restriction';
      if (cookie.sameSite) {
        const s = String(cookie.sameSite).toLowerCase();
        if (s === 'strict') sameSite = 'strict';
        else if (s === 'lax') sameSite = 'lax';
        else if (s === 'none' || s === 'no_restriction') sameSite = 'no_restriction';
      }

      // If sameSite is none/no_restriction, cookie must be secure
      if (sameSite === 'no_restriction' && !cookie.secure) {
        // Try with lax instead
        sameSite = 'lax';
      }

      const cookieDetails = {
        url: url,
        name: String(cookie.name),
        value: String(cookie.value || ''),
        path: cookie.path || '/',
        secure: Boolean(cookie.secure),
        httpOnly: Boolean(cookie.httpOnly),
        sameSite: sameSite
      };

      // Handle expiration - set future date if expired or session
      if (cookie.expirationDate && cookie.expirationDate > Date.now() / 1000) {
        cookieDetails.expirationDate = cookie.expirationDate;
      } else if (!cookie.session) {
        // Set expiration to 1 year from now for expired cookies
        cookieDetails.expirationDate = Math.floor(Date.now() / 1000) + 31536000;
      }

      // Try with domain first (for subdomain cookies)
      try {
        if (cookie.domain && cookie.domain.startsWith('.')) {
          cookieDetails.domain = cookie.domain;
        }
        await browser.cookies.set(cookieDetails);
        imported++;
      } catch (e1) {
        // Retry without domain (host-only cookie)
        try {
          delete cookieDetails.domain;
          await browser.cookies.set(cookieDetails);
          imported++;
        } catch (e2) {
          // Final retry with https if was http
          if (!cookie.secure) {
            try {
              cookieDetails.url = 'https://' + domain + (cookie.path || '/');
              cookieDetails.secure = true;
              await browser.cookies.set(cookieDetails);
              imported++;
            } catch (e3) {
              failed++;
            }
          } else {
            failed++;
          }
        }
      }
    } catch (e) {
      failed++;
    }
  }

  return { success: true, imported, failed };
}
