// Refresh data/posts.json, data/categories.json, and media/ from WordPress.com.
// Usage: node scripts/backup.mjs
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'rajatkbanerjee07gmailcom-ojuie.wordpress.com';
const API = `https://public-api.wordpress.com/rest/v1.1/sites/${SITE}`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA_DIR = path.join(ROOT, 'media');
const DATA_DIR = path.join(ROOT, 'data');
const HOSTS = [
  `${SITE}/wp-content/uploads`,
  `${SITE.replace('.wordpress.com', '.files.wordpress.com')}`,
];

const URL_RE = /https?:\/\/[^"'\\\s<>]+/g;

function storageKey(url) {
  const bare = url.split('#')[0].split('?')[0];
  const marker = '/wp-content/uploads/';
  const at = bare.indexOf(marker);
  if (at !== -1) return decodeURIComponent(bare.slice(at + marker.length));
  const files = '.files.wordpress.com/';
  const ft = bare.indexOf(files);
  if (ft !== -1) return decodeURIComponent(bare.slice(ft + files.length));
  return null;
}

function localPath(key) {
  return `media/${key.replaceAll('/', '-')}`;
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteString(value, keys) {
  let out = value;
  for (const key of keys) {
    const local = localPath(key);
    const body = escapeReg(key.split('/').map(encodeURIComponent).join('/'));
    const raw = escapeReg(key);
    for (const form of new Set([body, raw])) {
      const re = new RegExp(`https?:\\/\\/(?:${HOSTS.map(escapeReg).join('|')})\\/${form}(?:\\?[^\\s"'<>]*)?`, 'g');
      out = out.replace(re, local);
    }
  }
  return out;
}

function rewrite(value, keys) {
  if (typeof value === 'string') return rewriteString(value, keys);
  if (Array.isArray(value)) return value.map(item => rewrite(item, keys));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = rewrite(value[key], keys);
    return out;
  }
  return value;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function allPosts() {
  const posts = [];
  let page = 1;
  let found = Infinity;
  while (posts.length < found) {
    const data = await getJson(`${API}/posts/?number=100&page=${page}`);
    found = data.found ?? posts.length;
    if (!data.posts?.length) break;
    posts.push(...data.posts);
    page += 1;
  }
  return posts;
}

function collectKeys(posts) {
  const keys = new Map();
  const consider = url => {
    if (!url || typeof url !== 'string') return;
    const key = storageKey(url);
    if (!key || !/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(key)) return;
    if (!keys.has(key)) keys.set(key, new Set());
    keys.get(key).add(url);
  };
  const walk = value => {
    if (typeof value === 'string') {
      if (value.startsWith('http')) consider(value);
      for (const match of value.matchAll(URL_RE)) consider(match[0]);
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  posts.forEach(walk);
  return keys;
}

function preferredUrl(urls) {
  const list = [...urls];
  const upload = list.find(url => url.includes('/wp-content/uploads/'));
  return (upload || list[0]).split('#')[0].split('?')[0];
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`not an image (${type}) ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, bytes);
  return bytes.length;
}

async function pool(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

function slimPost(post) {
  const categories = {};
  for (const cat of Object.values(post.categories || {})) {
    categories[cat.slug] = { ID: cat.ID, name: cat.name, slug: cat.slug };
  }
  const attachments = {};
  for (const att of Object.values(post.attachments || {})) {
    if (att.mime_type && !String(att.mime_type).startsWith('image/')) continue;
    attachments[String(att.ID)] = {
      ID: att.ID,
      URL: att.URL,
      mime_type: att.mime_type || '',
      width: att.width || 0,
      height: att.height || 0,
    };
  }
  const thumb = post.post_thumbnail && post.post_thumbnail.URL ? { URL: post.post_thumbnail.URL } : null;
  return {
    ID: post.ID,
    slug: post.slug,
    URL: post.URL,
    title: post.title,
    date: post.date,
    excerpt: post.excerpt || '',
    content: post.content || '',
    featured_image: post.featured_image || '',
    post_thumbnail: thumb,
    categories,
    attachments,
  };
}

const posts = (await allPosts()).map(slimPost);
posts.sort((a, b) => new Date(b.date) - new Date(a.date) || b.ID - a.ID);
const keys = collectKeys(posts);
const orderedKeys = [...keys.keys()].sort((a, b) => b.length - a.length);

await mkdir(MEDIA_DIR, { recursive: true });
await mkdir(DATA_DIR, { recursive: true });

const savedSizes = [];
await pool([...keys.entries()], 4, async ([key, urls]) => {
  const dest = path.join(ROOT, localPath(key));
  savedSizes.push(await download(preferredUrl(urls), dest));
});
const imageBytes = savedSizes.reduce((sum, size) => sum + size, 0);

const rewritten = rewrite(posts, orderedKeys);
const counts = {};
for (const post of rewritten) {
  for (const cat of Object.values(post.categories)) counts[cat.slug] = (counts[cat.slug] || 0) + 1;
}
const apiCategories = await getJson(`${API}/categories?number=100`);
const categories = (apiCategories.categories || [])
  .map(cat => ({ ID: cat.ID, name: cat.name, slug: cat.slug, post_count: counts[cat.slug] || 0 }))
  .sort((a, b) => a.slug.localeCompare(b.slug));
for (const post of rewritten) {
  for (const cat of Object.values(post.categories)) cat.post_count = counts[cat.slug] || 0;
}

const blob = JSON.stringify({ posts: rewritten });
if (blob.includes('wp-content/uploads') || blob.includes('files.wordpress.com')) {
  throw new Error('Remote image URLs are still present in the post backup');
}
await writeFile(path.join(DATA_DIR, 'posts.json'), JSON.stringify({ posts: rewritten }, null, 2) + '\n');
await writeFile(path.join(DATA_DIR, 'categories.json'), JSON.stringify({ categories }, null, 2) + '\n');

const keep = new Set([...keys.keys()].map(key => path.basename(localPath(key))));
for (const name of await readdir(MEDIA_DIR)) {
  if (!keep.has(name)) await rm(path.join(MEDIA_DIR, name));
}

console.log(`Backed up ${rewritten.length} posts and ${keys.size} images (${(imageBytes / 1e6).toFixed(1)} MB)`);
