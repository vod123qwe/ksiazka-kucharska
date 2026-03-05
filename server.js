const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const DIR = __dirname;
const RECIPES_FILE = path.join(DIR, 'recipes.json');

// ── helpers ──────────────────────────────────────────

function readRecipes() {
  try {
    return JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeRecipes(recipes) {
  fs.writeFileSync(RECIPES_FILE, JSON.stringify(recipes, null, 2), 'utf8');
}

function serveFile(res, filePath, contentType) {
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── server ───────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  // ── Static files ──
  if (method === 'GET' && pathname === '/') {
    serveFile(res, path.join(DIR, 'ksiazka_kucharska.html'), 'text/html; charset=utf-8');
    return;
  }

  if (method === 'GET' && pathname.startsWith('/images/')) {
    const imgFile = path.join(DIR, pathname);
    const ext = path.extname(imgFile).toLowerCase();
    const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
    serveFile(res, imgFile, mime);
    return;
  }

  // ── API: GET all recipes ──
  if (method === 'GET' && pathname === '/api/recipes') {
    json(res, 200, readRecipes());
    return;
  }

  // ── API: POST new recipe ──
  if (method === 'POST' && pathname === '/api/recipes') {
    try {
      const recipe = await readBody(req);
      if (!recipe.title) { json(res, 400, { error: 'title required' }); return; }
      if (!recipe.id) recipe.id = slugify(recipe.title);

      const recipes = readRecipes();
      if (recipes.find(r => r.id === recipe.id)) {
        json(res, 409, { error: 'Recipe with this id already exists' });
        return;
      }

      recipes.push(recipe);
      writeRecipes(recipes);
      json(res, 201, recipe);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
    return;
  }

  // ── API: PUT update recipe ──
  if (method === 'PUT' && pathname.startsWith('/api/recipes/')) {
    const id = pathname.replace('/api/recipes/', '');
    try {
      const update = await readBody(req);
      const recipes = readRecipes();
      const idx = recipes.findIndex(r => r.id === id);
      if (idx === -1) { json(res, 404, { error: 'Not found' }); return; }

      recipes[idx] = { ...recipes[idx], ...update, id };
      writeRecipes(recipes);
      json(res, 200, recipes[idx]);
    } catch (e) {
      json(res, 400, { error: e.message });
    }
    return;
  }

  // ── API: DELETE recipe ──
  if (method === 'DELETE' && pathname.startsWith('/api/recipes/')) {
    const id = pathname.replace('/api/recipes/', '');
    const recipes = readRecipes();
    const filtered = recipes.filter(r => r.id !== id);
    if (filtered.length === recipes.length) { json(res, 404, { error: 'Not found' }); return; }
    writeRecipes(filtered);
    json(res, 200, { ok: true });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Ksiazka kucharska dziala na http://localhost:${PORT}`);
});
