// app.js (ES module)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://brnromvxcpzobwpkwepy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybnJvbXZ4Y3B6b2J3cGt3ZXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwOTkwOTQsImV4cCI6MjA3ODY3NTA5NH0.FcIogKfFuCyxwyZBgQbLoQkincg9JmJ8CKCBf_X0XSA";

const ADMIN_API_BASE = "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// DOM
const el = id => document.getElementById(id);
const btnSignUp = el('btnSignUp'), btnLogin = el('btnLogin'), btnSignOut = el('btnSignOut');
const authSection = el('authSection'), uploadSection = el('uploadSection'), gallerySection = el('gallerySection');
const adminSection = el('adminSection'), fullView = el('fullView');
const fileInput = el('fileInput'), btnUpload = el('btnUpload');
const gallery = el('gallery'), fullImage = el('fullImage');
const btnDelete = el('btnDelete'), btnBack = el('btnBack');
const adminOutput = el('adminOutput');
const authMsg = el('authMsg'), uploadMsg = el('uploadMsg');

async function init() {
  setupUIHandlers();
  const { data: { session } } = await supabase.auth.getSession();
  handleAuth(session);
  supabase.auth.onAuthStateChange((event, session) => handleAuth(session));
}

function setupUIHandlers(){
  btnSignUp.onclick = () => authSection.style.display = 'block';
  btnLogin.onclick = () => authSection.style.display = 'block';
  btnSignOut.onclick = signOut;

  el('btnEmailSignUp').onclick = emailSignUp;
  el('btnEmailLogin').onclick = emailLogin;
  el('btnGoogle').onclick = googleSignIn;
  el('btnPhone').onclick = phoneSignIn;

  btnUpload.onclick = () => {
    const f = fileInput.files[0];
    if (!f) return uploadMsg.innerText = 'Choose a file first';
    uploadImage(f).catch(e => uploadMsg.innerText = e.message);
  };

  btnBack.onclick = () => {
    fullView.style.display = 'none';
    gallerySection.style.display = 'block';
  };

  btnDelete.onclick = moveToTrash;

  el('btnListUsers').onclick = listUsersAdmin;
}

async function handleAuth(session){
  if (session?.user) {
    // logged-in
    btnSignOut.style.display = 'inline-block';
    btnSignUp.style.display = btnLogin.style.display = 'none';
    uploadSection.style.display = 'block';
    gallerySection.style.display = 'block';
    adminSection.style.display = 'block'; // show admin UI; actual admin actions should be protected server-side
    await loadGallery();
  } else {
    btnSignOut.style.display = 'none';
    btnSignUp.style.display = btnLogin.style.display = 'inline-block';
    uploadSection.style.display = 'none';
    gallerySection.style.display = 'none';
    adminSection.style.display = 'none';
  }
}

/* ------------------ AUTH FLOWS ------------------ */

async function emailSignUp(){
  const email = el('email').value;
  const password = el('password').value;
  authMsg.innerText = '';
  if (!email || !password) return authMsg.innerText = 'Provide email and password';
  const { error } = await supabase.auth.signUp({ email, password }, { emailRedirectTo: window.location.href });
  if (error) authMsg.innerText = 'Sign up error: ' + error.message;
  else authMsg.innerText = 'Check your email to verify (magic link sent).';
}

async function emailLogin(){
  const email = el('email').value;
  const password = el('password').value;
  authMsg.innerText = '';
  if (!email || !password) return authMsg.innerText = 'Provide email and password';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authMsg.innerText = 'Login error: ' + error.message;
  else authMsg.innerText = 'Logged in.';
}

async function googleSignIn(){
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  if (error) authMsg.innerText = 'OAuth error: ' + error.message;
}

async function phoneSignIn(){
  const phone = prompt('Enter phone number with country code (e.g. +919999999999):');
  if (!phone) return;
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) authMsg.innerText = 'Phone error: ' + error.message;
  else authMsg.innerText = 'OTP sent — check your phone.';
}

async function signOut(){
  await supabase.auth.signOut();
  location.reload();
}

/* ------------------ UPLOAD / THUMBNAIL / GALLERY ------------------ */

async function uploadImage(file) {
  uploadMsg.innerText = 'Uploading...';
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}.${ext}`;
  const filePath = `${user.id}/${filename}`;

  // 1. Upload full to private_photos with metadata user_id
  const { error: upErr } = await supabase.storage
    .from('private_photos')
    .upload(filePath, file, { cacheControl: '3600', upsert: false, metadata: { user_id: user.id } });

  if (upErr) throw upErr;

  // 2. Create thumbnail and upload to public_photos (same path)
  const thumbBlob = await createThumbnail(file, 300);
  const { error: tErr } = await supabase.storage
    .from('public_photos')
    .upload(filePath, thumbBlob, { cacheControl: '3600', upsert: true, metadata: { user_id: user.id } });

  if (tErr) throw tErr;

  // 3. Log activity
  await logActivity(user.id, 'upload', filePath);

  uploadMsg.innerText = 'Uploaded!';
  await loadGallery();
}

function createThumbnail(file, maxSize = 300) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height) {
        height = (height / width) * maxSize;
        width = maxSize;
      } else {
        width = (width / height) * maxSize;
        height = maxSize;
      }
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) reject(new Error('Thumbnail failed'));
        else resolve(new File([blob], 'thumb.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.8);
    };
    img.onerror = e => reject(e);
    img.src = URL.createObjectURL(file);
  });
}

async function loadGallery() {
  gallery.innerHTML = 'Loading...';
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { gallery.innerHTML = ''; return; }
  const folder = `${user.id}/`;

  // list public thumbnails in public_photos for the user
  const { data: files, error } = await supabase.storage.from('public_photos').list(folder, { limit: 100, offset: 0 });
  if (error) { gallery.innerHTML = 'Failed to load gallery: ' + error.message; return; }
  gallery.innerHTML = '';
  if (!files || files.length === 0) { gallery.innerHTML = '<p>No photos yet.</p>'; return; }

  for (const f of files) {
    const publicUrl = supabase.storage.from('public_photos').getPublicUrl(folder + f.name).data.publicUrl;
    const img = document.createElement('img');
    img.src = publicUrl;
    img.title = f.name;
    img.onclick = () => openFullImage(folder + f.name);
    gallery.appendChild(img);
  }
}

let currentSelectedPath = null;

async function openFullImage(path) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Create signed URL for private_photos (1 hour)
  const { data, error } = await supabase.storage.from('private_photos').createSignedUrl(path, 3600);
  if (error) {
    alert('Failed to get signed url: ' + error.message);
    return;
  }
  fullImage.src = data.signedUrl;
  currentSelectedPath = path;
  gallerySection.style.display = 'none';
  fullView.style.display = 'block';
}

/* ------------------ DELETE -> MOVE TO TRASH ------------------ */

async function moveToTrash(){
  if (!currentSelectedPath) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Copy private_photos/<path> -> trash_photos/<path> using Storage API copy endpoint via REST
  // Supabase JS client doesn't have object copy -- use REST endpoint
  const copyResp = await fetch(`${SUPABASE_URL}/storage/v1/object/copy/private_photos/${encodeURIComponent(currentSelectedPath)}?to=trash_photos/${encodeURIComponent(currentSelectedPath)}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${await getUserAccessToken()}`
    }
  });

  if (!copyResp.ok) {
    alert('Failed to copy to trash: ' + await copyResp.text());
    return;
  }

  // 2. Delete from private_photos (so primary is moved)
  const { error: delErr } = await supabase.storage.from('private_photos').remove([currentSelectedPath]);
  if (delErr) {
    alert('Failed to delete original after copy: ' + delErr.message);
    return;
  }

  // 3. Remove public thumbnail so it disappears
  await supabase.storage.from('public_photos').remove([currentSelectedPath]);

  // 4. Log
  await logActivity(user.id, 'move_to_trash', currentSelectedPath);

  alert('Moved to trash');
  currentSelectedPath = null;
  fullView.style.display = 'none';
  await loadGallery();
}

async function getUserAccessToken(){
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? '';
}

/* ------------------ ACTIVITY LOGGING ------------------ */

async function logActivity(userId, action, objectPath) {
  try {
    await supabase.from('activity_logs').insert([{ user_id: userId, action, object_path: objectPath }]);
  } catch (e) {
    console.warn('Failed to log activity', e);
  }
}

/* ------------------ ADMIN -> LIST USERS (uses your admin serverless) ------------------ */

async function listUsersAdmin() {
  adminOutput.textContent = 'Loading users...';
  try {
    if (!ADMIN_API_BASE) {
      adminOutput.textContent = 'ADMIN_API_BASE not set. Deploy admin-server and set ADMIN_API_BASE in app.js';
      return;
    }
    const r = await fetch(`${ADMIN_API_BASE}/users`);
    const txt = await r.text();
    adminOutput.textContent = txt;
  } catch (e) {
    adminOutput.textContent = 'Admin error: ' + e.message;
  }
}

/* ------------------ INIT ------------------ */
init();


