#!/usr/bin/env node
'use strict';

/**
 * Scan all public repos of GITHUB_USER (default hanx-hep), keep the ones
 * marked with the "slidev" topic and with GitHub Pages enabled, probe each
 * published site for its <title>, and rewrite index.html between the
 * <!--SLIDES:DECKS--> ... <!--/SLIDES:DECKS--> markers.
 */

const fs = require('fs');
const path = require('path');

const USER = process.env.GITHUB_USER || 'hanx-hep';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const TOPICS = JSON.parse(fs.readFileSync(path.join(__dirname, 'topics.json'), 'utf8'));
const API = 'https://api.github.com';

async function api(pathname) {
  const res = await fetch(API + pathname, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'hanx-hep-slides-index',
      ...(TOKEN ? { authorization: 'Bearer ' + TOKEN } : {}),
    },
  });
  if (!res.ok) throw new Error(`GET ${pathname} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function listRepos() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const batch = await api(`/users/${USER}/repos?per_page=100&page=${page}&type=owner&sort=pushed`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function isSlidev(repo) {
  const topics = (repo.topics || []).map((t) => t.toLowerCase());
  return repo.has_pages && topics.includes('slidev');
}

function classify(topics) {
  const set = new Set((topics || []).map((t) => t.toLowerCase()));
  for (const key of Object.keys(TOPICS)) {
    if (set.has(key)) return TOPICS[key];
  }
  return { label: '其他', tagClass: '' };
}

function pagesUrl(name) {
  if (name.toLowerCase() === `${USER}.github.io`.toLowerCase()) return `https://${USER}.github.io/`;
  return `https://${USER}.github.io/${name}/`;
}

async function probeTitle(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; slides-index/1.0)' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<title>([^<]*)<\/title>/i);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next;
      next += 1;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

(async () => {
  const repos = (await listRepos()).filter(isSlidev);
  console.log(`found ${repos.length} slidev repos for ${USER}`);

  const decks = await mapLimit(repos, 3, async (repo, i) => {
    const url = pagesUrl(repo.name);
    await new Promise((r) => setTimeout(r, i * 200));
    const title = await probeTitle(url);
    if (!title) console.log(`  warn: could not probe ${url}, falling back to repo name`);
    return {
      repo: repo.name,
      url,
      title: title || repo.name,
      desc: (repo.description || '').trim(),
      updated: (repo.pushed_at || '').slice(0, 10) || '-',
      cat: classify(repo.topics || []),
    };
  });

  decks.sort((a, b) => (a.updated < b.updated ? 1 : -1));

  const cards = decks
    .map((d) => {
      const subtitle = d.desc ? `\n      <span>${esc(d.desc)}</span>` : '';
      return `    <a class="card ${d.cat.tagClass}" href="${esc(d.url)}">
      <span class="tag">${esc(d.cat.label)}</span>
      <b>${esc(d.title)}</b>${subtitle}
      <span class="meta">更新 ${esc(d.updated)} · <code>${esc(d.repo)}</code></span>
    </a>`;
    })
    .join('\n');

  const now = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  let html = fs.readFileSync(INDEX, 'utf8');
  const decksRe = /<!--SLIDES:DECKS-->[\s\S]*?<!--\/SLIDES:DECKS-->/;
  const updatedRe = /<!--SLIDES:UPDATED-->[^<]*<!--\/SLIDES:UPDATED-->/;
  if (!decksRe.test(html) || !updatedRe.test(html)) {
    throw new Error('markers not found in index.html');
  }
  html = html.replace(decksRe, `<!--SLIDES:DECKS-->\n${cards}\n  <!--/SLIDES:DECKS-->`);
  html = html.replace(updatedRe, `<!--SLIDES:UPDATED-->${esc(now)}<!--/SLIDES:UPDATED-->`);
  fs.writeFileSync(INDEX, html);

  console.log(`index.html updated: ${decks.length} decks, ${now}`);
  for (const d of decks) console.log(`  - ${d.repo} [${d.cat.label}] ${d.title}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
