/**
 * Cookie Manager - Sidebar Script
 * Export & Import
 */

class CookieManager {
  constructor() {
    this.initElements();
    this.initEventListeners();
    this.loadTheme();
    this.loadStats();
    this.getCurrentTab();
  }

  initElements() {
    // Theme
    this.themeToggle = document.getElementById('themeToggle');
    
    // Tabs
    this.tabs = document.querySelectorAll('.tab');
    this.tabContents = document.querySelectorAll('.tab-content');
    
    // Message
    this.message = document.getElementById('message');
    
    // Export
    this.encryptExport = document.getElementById('encryptExport');
    this.exportPassword = document.getElementById('exportPassword');
    this.filterCurrentSite = document.getElementById('filterCurrentSite');
    this.filterCustomDomain = document.getElementById('filterCustomDomain');
    this.currentDomain = document.getElementById('currentDomain');
    this.customDomain = document.getElementById('customDomain');
    this.totalCookies = document.getElementById('totalCookies');
    this.selectedCookies = document.getElementById('selectedCookies');
    this.exportBtn = document.getElementById('exportBtn');
    
    // Import
    this.encryptImport = document.getElementById('encryptImport');
    this.importPassword = document.getElementById('importPassword');
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('fileInput');
    this.loading = document.getElementById('loading');
    this.importStats = document.getElementById('importStats');
    this.importedCount = document.getElementById('importedCount');
    this.failedCount = document.getElementById('failedCount');
  }

  initEventListeners() {
    // Theme
    this.themeToggle.addEventListener('click', () => this.toggleTheme());
    
    // Tabs
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
    
    // Export
    this.encryptExport.addEventListener('change', () => {
      this.exportPassword.style.display = this.encryptExport.checked ? 'block' : 'none';
    });
    
    this.filterCurrentSite.addEventListener('change', () => {
      this.currentDomain.style.display = this.filterCurrentSite.checked ? 'block' : 'none';
      if (this.filterCurrentSite.checked) {
        this.filterCustomDomain.checked = false;
        this.customDomain.style.display = 'none';
      }
      this.updateSelectedCount();
    });
    
    this.filterCustomDomain.addEventListener('change', () => {
      this.customDomain.style.display = this.filterCustomDomain.checked ? 'block' : 'none';
      if (this.filterCustomDomain.checked) {
        this.filterCurrentSite.checked = false;
        this.currentDomain.style.display = 'none';
      }
      this.updateSelectedCount();
    });
    
    this.customDomain.addEventListener('input', () => this.updateSelectedCount());
    this.exportBtn.addEventListener('click', () => this.exportCookies());
    
    // Import
    this.encryptImport.addEventListener('change', () => {
      this.importPassword.style.display = this.encryptImport.checked ? 'block' : 'none';
    });
    
    this.dropzone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) this.importCookies(e.target.files[0]);
    });
    
    this.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.classList.add('dragover');
    });
    
    this.dropzone.addEventListener('dragleave', () => {
      this.dropzone.classList.remove('dragover');
    });
    
    this.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) this.importCookies(e.dataTransfer.files[0]);
    });
  }

  // Theme
  loadTheme() {
    const theme = localStorage.getItem('cookieManagerTheme') || 'dark';
    document.body.className = theme;
  }

  toggleTheme() {
    const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
    document.body.className = newTheme;
    localStorage.setItem('cookieManagerTheme', newTheme);
  }

  // Tabs
  switchTab(tabName) {
    this.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    this.tabContents.forEach(c => c.classList.toggle('active', c.id === `${tabName}-tab`));
    this.hideMessage();
  }

  // Message
  showMessage(text, type) {
    this.message.textContent = text;
    this.message.className = `message show ${type}`;
  }

  hideMessage() {
    this.message.classList.remove('show');
  }

  // Get current tab
  async getCurrentTab() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url) {
        this.currentDomainValue = new URL(tabs[0].url).hostname;
        this.currentDomain.value = this.currentDomainValue;
      }
    } catch (e) {}
  }

  // Stats
  async loadStats() {
    try {
      const cookies = await browser.cookies.getAll({});
      this.totalCookies.textContent = cookies.length;
      this.selectedCookies.textContent = cookies.length;
    } catch (e) {}
  }

  async updateSelectedCount() {
    const cookies = await this.getFilteredCookies();
    this.selectedCookies.textContent = cookies.length;
  }

  async getFilteredCookies() {
    let cookies = await browser.cookies.getAll({});
    
    if (this.filterCurrentSite.checked && this.currentDomainValue) {
      cookies = cookies.filter(c => 
        c.domain.includes(this.currentDomainValue) || 
        this.currentDomainValue.includes(c.domain.replace(/^\./, ''))
      );
    } else if (this.filterCustomDomain.checked && this.customDomain.value) {
      const domain = this.customDomain.value.toLowerCase();
      cookies = cookies.filter(c => 
        c.domain.toLowerCase().includes(domain) || 
        domain.includes(c.domain.replace(/^\./, '').toLowerCase())
      );
    }
    
    return cookies;
  }

  // Export
  async exportCookies() {
    try {
      const cookies = await this.getFilteredCookies();
      
      if (!cookies.length) {
        this.showMessage('No cookies to export', 'warning');
        return;
      }
      
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        browser: 'Firefox',
        encrypted: this.encryptExport.checked,
        cookies: cookies.map(c => ({
          domain: c.domain,
          expirationDate: c.expirationDate,
          hostOnly: c.hostOnly,
          httpOnly: c.httpOnly,
          name: c.name,
          path: c.path,
          sameSite: c.sameSite,
          secure: c.secure,
          session: c.session,
          value: c.value
        }))
      };
      
      let fileName, fileContent;
      
      if (this.encryptExport.checked) {
        const pwd = this.exportPassword.value;
        if (!pwd || pwd.length < 4) {
          this.showMessage('Password must be at least 4 characters', 'error');
          return;
        }
        exportData.cookies = await this.encrypt(exportData.cookies, pwd);
        fileName = `cookies_encrypted_${this.formatDate()}.cookiejar`;
      } else {
        fileName = `cookies_${this.formatDate()}.json`;
      }
      
      fileContent = JSON.stringify(exportData, null, 2);
      
      const blob = new Blob([fileContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showMessage(`${cookies.length} cookies exported!`, 'success');
    } catch (e) {
      this.showMessage('Export error: ' + e.message, 'error');
    }
  }

  // Import
  async importCookies(file) {
    this.hideMessage();
    this.importStats.style.display = 'none';
    this.loading.classList.add('show');
    this.dropzone.style.display = 'none';

    try {
      const content = await file.text();
      const data = JSON.parse(content);

      if (!data.version || !data.cookies) {
        throw new Error('Invalid file format');
      }

      let cookies;

      if (data.encrypted) {
        const pwd = this.importPassword.value;
        if (!pwd) {
          this.loading.classList.remove('show');
          this.dropzone.style.display = 'block';
          this.showMessage('File is encrypted. Enter password.', 'error');
          this.encryptImport.checked = true;
          this.importPassword.style.display = 'block';
          return;
        }
        try {
          cookies = await this.decrypt(data.cookies, pwd);
        } catch (e) {
          this.loading.classList.remove('show');
          this.dropzone.style.display = 'block';
          this.showMessage('Wrong password', 'error');
          return;
        }
      } else {
        cookies = data.cookies;
      }

      const result = await browser.runtime.sendMessage({
        action: 'importCookies',
        cookies: cookies
      });

      this.loading.classList.remove('show');
      this.dropzone.style.display = 'block';
      
      this.importedCount.textContent = result.imported;
      this.failedCount.textContent = result.failed;
      this.importStats.style.display = 'flex';
      this.loadStats();

      if (result.failed > 0) {
        this.showMessage('Done! Some cookies failed.', 'warning');
      } else {
        this.showMessage('All cookies imported!', 'success');
      }
    } catch (e) {
      this.loading.classList.remove('show');
      this.dropzone.style.display = 'block';
      this.showMessage('Error: ' + e.message, 'error');
    }

    this.fileInput.value = '';
  }

  // Encryption
  async encrypt(data, password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedData, password) {
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return JSON.parse(dec.decode(decrypted));
  }

  formatDate() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  }
}

document.addEventListener('DOMContentLoaded', () => new CookieManager());
