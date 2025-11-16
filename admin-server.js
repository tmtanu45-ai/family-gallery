// admin-server.js (Node/Express style for serverless)
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json'
};

// List users (requires service role)
app.get('/users', async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, { headers });
    const data = await r.json();
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }) }
});

// Hard-delete object (permanent)
app.post('/admin/delete-object', async (req, res) => {
  const { bucket, path } = req.body;
  if (!bucket || !path) return res.status(400).json({ error: "bucket & path required" });

  try {
    // DELETE storage object
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ ok: false, err });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }) }
});

// Restore from trash: copy object from trash_photos to private_photos
app.post('/admin/restore-object', async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ error: "path required" });

  try {
    // Fetch object from trash and then re-upload to private_photos
    // We'll use the storage copy API
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/copy/trash_photos/${encodeURIComponent(path)}?to=private_photos/${encodeURIComponent(path)}`, {
      method: 'POST',
      headers
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ ok: false, err });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }) }
});

module.exports = app;
