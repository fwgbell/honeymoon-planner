/* Encrypted storage: AES-256-GCM with a PBKDF2-SHA256 key, persisted as
   data.enc.json in the GitHub repo via the Contents API. Plaintext never
   touches storage; only ciphertext is cached locally for offline use. */
(function () {
  'use strict';

  const FILE = 'data.enc.json';
  const ITER = 600000;
  const LS = {
    repo: 'hm.repo',      // {owner, name, branch}
    token: 'hm.tok',      // token encrypted under the passphrase key
    cache: 'hm.cache',    // last known ciphertext file + sha
    local: 'hm.local',    // local test mode storage
  };

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const b64 = {
    from(buf) {
      const bytes = new Uint8Array(buf);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
    to(str) {
      const s = atob(str);
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    },
  };

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  async function deriveKey(pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function encryptStr(key, str) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(str));
    return { iv: b64.from(iv), ct: b64.from(ct) };
  }

  async function decryptStr(key, box) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.to(box.iv) }, key, b64.to(box.ct));
    return dec.decode(pt);
  }

  function isLocalHost() {
    return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  }

  function defaultRepo() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!m) return null;
    const seg = location.pathname.split('/').filter(Boolean)[0];
    const name = seg && !/\.html?$/i.test(seg) ? seg : `${m[1]}.github.io`;
    return { owner: m[1], name, branch: 'main' };
  }

  const Store = {
    key: null,
    file: null,      // {v, kdf, iter, salt, iv, ct}
    sha: null,
    token: null,
    source: null,    // 'github' | 'pages' | 'cache' | 'local'

    passphraseOk(p) {
      const words = p.trim().split(/\s+/).filter(Boolean).length;
      return p.length >= 16 || (words >= 4 && p.length >= 12);
    },

    get repo() { return lsGet(LS.repo) || defaultRepo(); },
    setRepo(r) { lsSet(LS.repo, r); },
    get localMode() { return isLocalHost() && !this.token && !lsGet(LS.repo); },
    get canWrite() { return !!this.token || this.localMode; },
    get hasStoredToken() { return !!lsGet(LS.token); },

    apiUrl() {
      const r = this.repo;
      if (!r) throw new Error('Repository not configured');
      return `https://api.github.com/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}/contents/${FILE}`;
    },

    headers() {
      return {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      };
    },

    async apiGet() {
      const r = this.repo;
      const res = await fetch(`${this.apiUrl()}?ref=${encodeURIComponent(r.branch || 'main')}`, { headers: this.headers(), cache: 'no-store' });
      if (res.status === 404) return null;
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error('GitHub token rejected (check it has Contents read/write on this repo)'), { code: 'auth' });
      if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
      const j = await res.json();
      return { file: JSON.parse(atob(j.content.replace(/\s/g, ''))), sha: j.sha };
    },

    /* Pre-unlock load. Returns the ciphertext file or null when nothing exists yet. */
    async loadPublic() {
      if (isLocalHost()) {
        const local = lsGet(LS.local);
        if (local && !lsGet(LS.repo)) { this.file = local; this.source = 'local'; return local; }
      }
      try {
        const res = await fetch(`./${FILE}?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          this.file = await res.json();
          this.source = 'pages';
          lsSet(LS.cache, { file: this.file, sha: null });
          return this.file;
        }
        if (res.status === 404) {
          const c = lsGet(LS.cache);
          if (c) { this.file = c.file; this.source = 'cache'; return c.file; }
          return null;
        }
        throw new Error(String(res.status));
      } catch (e) {
        const c = lsGet(LS.cache);
        if (c) { this.file = c.file; this.sha = c.sha; this.source = 'cache'; return c.file; }
        throw Object.assign(new Error('Offline and no saved copy on this device yet'), { code: 'offline' });
      }
    },

    /* Throws on a wrong passphrase (GCM auth failure). */
    async unlock(pass) {
      const f = this.file;
      const key = await deriveKey(pass, b64.to(f.salt), f.iter || ITER);
      let data;
      try { data = JSON.parse(await decryptStr(key, f)); } catch (e) {
        throw Object.assign(new Error('Wrong passphrase'), { code: 'pass' });
      }
      this.key = key;
      const t = lsGet(LS.token);
      if (t) {
        try { this.token = await decryptStr(key, t); } catch (e) { lsDel(LS.token); }
      }
      return data;
    },

    /* Pull the freshest copy (GitHub API when we have a token). Returns
       decrypted remote data, or null if unchanged / unavailable. */
    async pull() {
      if (!this.token) return null;
      const got = await this.apiGet();
      if (!got) return null;
      const changed = got.sha !== this.sha;
      this.sha = got.sha;
      if (!changed) return null;
      if (got.file.salt !== this.file.salt) {
        throw Object.assign(new Error('The passphrase was changed on another device. Lock and unlock with the new one.'), { code: 'rekeyed' });
      }
      this.file = got.file;
      this.source = 'github';
      lsSet(LS.cache, { file: got.file, sha: got.sha });
      return JSON.parse(await decryptStr(this.key, got.file));
    },

    async buildFile(data, salt, iter) {
      const box = await encryptStr(this.key, JSON.stringify(data));
      return { v: 1, kdf: 'PBKDF2-SHA256', iter, salt, iv: box.iv, ct: box.ct };
    },

    /* merge(localData, remoteData) -> merged; used on write conflicts. */
    async save(data, merge) {
      if (!this.key) throw new Error('Locked');
      if (this.localMode) {
        const f = await this.buildFile(data, this.file.salt, this.file.iter);
        this.file = f; lsSet(LS.local, f); this.source = 'local';
        return data;
      }
      if (!this.token) throw Object.assign(new Error('Read-only on this device: add a GitHub token in Settings to save'), { code: 'readonly' });
      let attempt = 0;
      let current = data;
      if (!this.sha) { const g = await this.apiGet(); if (g) this.sha = g.sha; }
      while (attempt++ < 4) {
        const f = await this.buildFile(current, this.file.salt, this.file.iter);
        const body = { message: 'Update plan', content: btoa(JSON.stringify(f)), branch: this.repo.branch || 'main' };
        if (this.sha) body.sha = this.sha;
        const res = await fetch(this.apiUrl(), { method: 'PUT', headers: this.headers(), body: JSON.stringify(body) });
        if (res.ok) {
          const j = await res.json();
          this.sha = j.content.sha; this.file = f; this.source = 'github';
          lsSet(LS.cache, { file: f, sha: this.sha });
          return current;
        }
        if (res.status === 409 || res.status === 422) {
          const g = await this.apiGet();
          if (!g) { this.sha = null; continue; }
          this.sha = g.sha;
          if (g.file.salt !== this.file.salt) throw Object.assign(new Error('Passphrase changed elsewhere'), { code: 'rekeyed' });
          const remote = JSON.parse(await decryptStr(this.key, g.file));
          current = merge(current, remote);
          continue;
        }
        if (res.status === 401 || res.status === 403) throw Object.assign(new Error('GitHub token rejected'), { code: 'auth' });
        throw new Error(`GitHub save failed (${res.status})`);
      }
      throw new Error('Could not save after several conflicts; try again');
    },

    /* First-time setup: create the encrypted file from seed data. */
    async create(pass, data, token, repo) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      this.key = await deriveKey(pass, salt, ITER);
      this.file = { salt: b64.from(salt), iter: ITER };
      if (repo) this.setRepo(repo);
      if (token) { this.token = token; await this.storeToken(token); }
      const f = await this.buildFile(data, this.file.salt, ITER);
      this.file = f;
      if (token) {
        this.sha = null;
        await this.save(data, (l) => l);
      } else if (isLocalHost()) {
        lsSet(LS.local, f); this.source = 'local';
      }
      return f;
    },

    async storeToken(token) {
      this.token = token;
      lsSet(LS.token, await encryptStr(this.key, token));
    },
    clearToken() { this.token = null; lsDel(LS.token); },

    async testToken(token) {
      const r = this.repo;
      const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!res.ok) throw new Error(`Token check failed (${res.status})`);
      const j = await res.json();
      if (!j.permissions || !j.permissions.push) throw new Error('Token can read but not write this repo');
      return true;
    },

    async changePassphrase(newPass, data) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const oldKey = this.key;
      const oldFile = this.file;
      this.key = await deriveKey(newPass, salt, ITER);
      this.file = { ...this.file, salt: b64.from(salt), iter: ITER };
      try {
        if (this.token) await this.storeToken(this.token);
        await this.save(data, (l) => l);
      } catch (e) {
        this.key = oldKey; this.file = oldFile;
        if (this.token) await this.storeToken(this.token);
        throw e;
      }
    },

    downloadCipher() {
      const blob = new Blob([JSON.stringify(this.file)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = FILE; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    lock() { this.key = null; this.token = null; },
    isLocalHost,
  };

  window.Store = Store;
})();
