// app.js (updated: includes password strength checker, sign-up blocking for weak passwords,
// and filename escaping + photo-name usage in gallery rendering)

// ---------- SUPABASE SETUP ----------
const SUPABASE_URL = "https://brnromvxcpzobwpkwepy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybnJvbXZ4Y3B6b2J3cGt3ZXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwOTkwOTQsImV4cCI6MjA3ODY3NTA5NH0.FcIogKfFuCyxwyZBgQbLoQkincg9JmJ8CKCBf_X0XSA";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "family_photos";

// helpers
function $ (id) { return document.getElementById(id); }
const page = window.location.pathname.split("/").pop() || "index.html";

// simple HTML escape to avoid title attribute breaking
function escHtml(s){ return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

/* ---------- FORCE LOGIN PROTECTION (index + admin) ---------- */
async function requireLogin() {
  const protected = ["index.html", "admin.html", ""];
  if (!protected.includes(page)) return;
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = "login.html";
  }
}
requireLogin();

/* ---------- COMMON UI ---------- */
async function loadUICommon() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  const authInfo = $("authInfo");
  const btnSignOut = $("btnSignOut");
  const adminLink = $("adminLink");

  if (!authInfo) {
    // no header on login page
  } else {
    if (!user) {
      authInfo.textContent = "";
      if (btnSignOut) btnSignOut.style.display = "none";
      if (adminLink) adminLink.style.display = "none";
    } else {
      authInfo.textContent = user.email || user.phone;
      if (btnSignOut) btnSignOut.style.display = "inline-block";

      // show admin link only to admin
      const { data: profile } = await supabaseClient.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role === "admin" && adminLink) adminLink.style.display = "inline-block";
    }
  }
}

/* ---------- SIGN OUT (global) ---------- */
if ($("btnSignOut")) {
  $("btnSignOut").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}

/* ---------- FULLSCREEN IMAGE VIEWER ---------- */
window.openImageViewer = (url) => {
  const bg = $("imageViewerBg");
  const img = $("imageViewer");
  if (!bg || !img) return;
  img.src = url;
  bg.style.display = "flex";
};
if ($("imageViewerBg")) {
  $("imageViewerBg").addEventListener("click", () => {
    $("imageViewerBg").style.display = "none";
  });
}

/* ---------- AUTH HELPERS: forgot / reset / show forgot ---------- */
function showForgot() { const f = $("forgotPassword"); if (f) f.style.display = "block"; }

async function sendResetMail() {
  const email = $("loginEmail").value.trim();
  if (!email) return alert("Enter email first.");
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/login.html"
  });
  if (error) return alert(error.message);
  alert("Password reset email sent!");
}

/* ---------- ENFORCE VERIFIED USER (redirect to confirm-email page) ---------- */
async function enforceVerifiedUserOnLoad() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  if (!user.email_confirmed_at) {
    window.location.href = "confirm-email.html";
  }
}
window.addEventListener("load", enforceVerifiedUserOnLoad);

/* -------- PASSWORD STRENGTH CHECKER -------- */
function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;  // 0–5
}

function renderStrength(password) {
  const box = $("passwordStrength");
  if (!box) return;
  const score = checkPasswordStrength(password);
  let color = "#ff5959";
  let text = "Weak";
  if (score >= 3) { color = "#ffb347"; text = "Medium"; }
  if (score >= 4) { color = "#4cd964"; text = "Strong"; }
  box.innerHTML = `
    <div style="text-align:left;margin-bottom:6px">${text}</div>
    <div class="pw-bar" style="width:${score * 20}%; background:${color};"></div>
  `;
}

/* attach listener (works only on login page) */
if (page === "login.html") {
  const passInput = $("loginPassword");
  if (passInput) {
    passInput.addEventListener("input", () => {
      renderStrength(passInput.value);
    });
  }
}

/* ---------- LOGIN PAGE LOGIC ---------- */
if (page === "login.html") {
  // Elements
  const btnEmailSignIn = $("btnEmailSignIn");
  const btnEmailSignUp = $("btnEmailSignUp");
  const btnPhoneOtp = $("btnPhoneOtp");
  const btnGoogle = $("btnGoogle");
  const btnEmailOtp = $("btnEmailOtp");

  // Email sign-in (password)
  btnEmailSignIn?.addEventListener("click", async () => {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    if (!email || !password) return alert("Enter email & password.");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      if (/invalid|credentials/i.test(error.message)) {
        alert("Wrong password!");
        showForgot();
      } else {
        alert(error.message);
      }
      return;
    }

    // After successful sign-in, ensure verified
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user && !user.email_confirmed_at) {
      window.location.href = "confirm-email.html";
      return;
    }

    window.location.href = "index.html";
  });

  // Email sign-up (create account) with weak-password check
  btnEmailSignUp?.addEventListener("click", async () => {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    if (!email || !password) return alert("Enter email & password to sign up.");

    if (checkPasswordStrength(password) < 3) {
      alert("Your password is too weak. Use at least 10 chars, mixed case, numbers or symbols.");
      return;
    }

    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/index.html"
      }
    });

    if (error) return alert(error.message);

    alert("Sign-up complete. Check your email to verify your account.");
    window.location.href = "confirm-email.html";
  });

  // Phone OTP (SMS)
  btnPhoneOtp?.addEventListener("click", async () => {
    const phone = $("loginPhone").value.trim();
    if (!phone) return alert("Enter phone in E.164 format (e.g. +919999999999).");
    const { error } = await supabaseClient.auth.signInWithOtp({ phone });
    if (error) return alert(error.message);
    alert("OTP sent by SMS. (In test mode use 123456)");
  });

  // Email OTP (magic link)
  btnEmailOtp?.addEventListener("click", async () => {
    const email = $("loginEmail").value.trim();
    if (!email) return alert("Enter email first.");
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/index.html"
      }
    });
    if (error) return alert(error.message);
    alert("OTP / Magic Link sent to your email.");
  });

  // Google OAuth (redirect back to index.html)
  btnGoogle?.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/index.html",
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: false,
        flowType: "implicit"
      }
    });
    if (error) alert(error.message);
  });

  // If already logged in, redirect to index immediately (and check verification)
  window.addEventListener("load", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      if (!user.email_confirmed_at) {
        window.location.href = "confirm-email.html";
      } else {
        window.location.href = "index.html";
      }
    }
  });
}

/* ---------- INDEX PAGE (gallery + upload) ---------- */
if (page === "index.html" || page === "") {
  const fileInput = $("fileInput");
  const albumInput = $("albumInput");
  const galleryDiv = $("gallery");
  const albumsDiv = $("albums");
  const upStatus = $("upStatus");

  // Upload handler
  $("btnUpload")?.addEventListener("click", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return alert("Please login first.");
    const file = fileInput.files[0];
    if (!file) return alert("Select file.");
    const album = (albumInput.value || "uncategorized").trim();
    const path = `${album}/${user.id}/${Date.now()}_${file.name}`;

    const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file);
    if (error) return alert("Upload error: " + error.message);

    await supabaseClient.from("photos").insert({
      storage_path: path,
      album,
      filename: file.name,
      uploader: user.id,
      uploader_email: user.email || null
    });

    upStatus.textContent = "Uploaded ✓";
    loadAlbums();
    loadGallery();
  });

  // loadGallery: only admin sees uploader + delete
  async function loadGallery() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!galleryDiv) return;

    // check role
    const { data: profile } = await supabaseClient.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    const { data } = await supabaseClient.from("photos").select("*").order("created_at", { ascending: false });

    galleryDiv.innerHTML = "";
    (data || []).forEach(p => {
      const url = supabaseClient.storage.from(BUCKET).getPublicUrl(p.storage_path).data.publicUrl;
      const safeName = escHtml(p.filename);
      galleryDiv.innerHTML += `
        <div class="card">
          <img src="${url}" class="photo-img" onclick="openImageViewer('${url}')">
          <p class="photo-name" title="${safeName}">${safeName}</p>
          ${isAdmin ? `<p style="font-size:12px;opacity:0.7">Uploaded by: ${escHtml(p.uploader_email || 'unknown')}</p>` : ''}
          ${isAdmin ? `<button class="top-btn" onclick="deletePhoto('${p.id}','${p.storage_path}')">Delete</button>` : ''}
        </div>
      `;
    });
  }

  // Delete (works for admin only in UI; ensure RLS server-side for production)
  window.deletePhoto = async (id, path) => {
    if (!confirm("Delete this photo?")) return;
    const { error: e1 } = await supabaseClient.storage.from(BUCKET).remove([path]);
    if (e1) return alert("Storage delete error: " + e1.message);
    const { error: e2 } = await supabaseClient.from("photos").delete().eq("id", id);
    if (e2) return alert("DB delete error: " + e2.message);
    loadGallery();
  };

  // loadAlbums
  async function loadAlbums() {
    const { data } = await supabaseClient.from("photos").select("album");
    if (!albumsDiv) return;
    const names = [...new Set((data || []).map(r => r.album))];
    albumsDiv.innerHTML = "";
    names.forEach(n => {
      const btn = document.createElement("button");
      btn.className = "top-btn";
      btn.textContent = n;
      btn.onclick = () => filterAlbum(n);
      albumsDiv.appendChild(btn);
    });
  }

  // filterAlbum
  window.filterAlbum = async (name) => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: profile } = await supabaseClient.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    const { data } = await supabaseClient.from("photos").select("*").eq("album", name).order("created_at", { ascending: false });
    galleryDiv.innerHTML = "";
    (data || []).forEach(p => {
      const url = supabaseClient.storage.from(BUCKET).getPublicUrl(p.storage_path).data.publicUrl;
      const safeName = escHtml(p.filename);
      galleryDiv.innerHTML += `
        <div class="card">
          <img src="${url}" class="photo-img" onclick="openImageViewer('${url}')">
          <p class="photo-name" title="${safeName}">${safeName}</p>
          ${isAdmin ? `<p style="font-size:12px;opacity:0.7">Uploaded by: ${escHtml(p.uploader_email || 'unknown')}</p>` : ''}
          ${isAdmin ? `<button class="top-btn" onclick="deletePhoto('${p.id}','${p.storage_path}')">Delete</button>` : ''}
        </div>
      `;
    });
  };

  // init index page
  window.addEventListener("load", async () => {
    await loadUICommon();
    loadGallery();
    loadAlbums();
  });
}

/* ---------- ADMIN PAGE ---------- */
if (page === "admin.html") {

  // ensure only admin can view this page
  window.addEventListener("load", async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const { data: profile } = await supabaseClient.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      // not admin -> go home
      window.location.href = "index.html";
      return;
    }

    // admin UI initialization
    await loadUICommon();
    loadAdminUsers();
    loadAdminPhotos();
  });

  // load admin users
  async function loadAdminUsers() {
    const { data } = await supabaseClient.from("profiles").select("*");
    const target = $("adminUsers");
    if (!target) return;
    target.innerHTML = "";
    (data || []).forEach(u => {
      const div = document.createElement("div");
      div.style.padding = "10px";
      div.style.marginBottom = "8px";
      div.style.background = "rgba(255,255,255,0.04)";
      div.style.borderRadius = "8px";
      div.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="flex:1">
            <div><b>${escHtml(u.email || u.phone || 'unknown')}</b></div>
            <div style="font-size:13px;color:rgba(255,255,255,0.7)">id: ${escHtml(u.id)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="role_${escHtml(u.id)}">
              <option value="member" ${u.role==='member'?'selected':''}>member</option>
              <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
            </select>
            <button class="top-btn" onclick="updateRole('${escHtml(u.id)}')">Update</button>
          </div>
        </div>
      `;
      target.appendChild(div);
    });
  }

  // expose updateRole globally
  window.updateRole = async (id) => {
    const sel = $("role_" + id);
    if (!sel) return alert("Role select not found.");
    const role = sel.value;
    const { error } = await supabaseClient.from("profiles").update({ role }).eq('id', id);
    if (error) return alert("Role update error: " + error.message);
    alert("Role updated.");
    loadAdminUsers();
  };

  // admin photos (with delete)
  async function loadAdminPhotos() {
    const { data } = await supabaseClient.from("photos").select("*").order("created_at", { ascending: false });
    const box = $("adminPhotos");
    if (!box) return;
    box.innerHTML = "";
    (data || []).forEach(p => {
      const url = supabaseClient.storage.from(BUCKET).getPublicUrl(p.storage_path).data.publicUrl;
      const safeName = escHtml(p.filename);
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <img src="${url}" class="photo-img">
        <p style="margin:8px 0 4px"><b>${safeName}</b></p>
        <p style="font-size:12px;opacity:0.7">Uploaded by: ${escHtml(p.uploader_email || 'unknown')}</p>
        <button class="top-btn" onclick="adminDeletePhoto('${p.id}','${p.storage_path}')">Delete</button>
      `;
      box.appendChild(div);
    });
  }

  window.adminDeletePhoto = async (id, path) => {
    if (!confirm("Delete this photo?")) return;
    const { error: e1 } = await supabaseClient.storage.from(BUCKET).remove([path]);
    if (e1) return alert("Storage error: " + e1.message);
    const { error: e2 } = await supabaseClient.from("photos").delete().eq("id", id);
    if (e2) return alert("DB error: " + e2.message);
    loadAdminPhotos();
  };
}

/* ---------- ensure UI common loads on other pages ---------- */
window.addEventListener("load", () => { loadUICommon(); });
