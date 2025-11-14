/* ---------- SUPABASE SETUP ---------- */
const SUPABASE_URL = "https://brnromvxcpzobwpkwepy.supabase.co";
const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybnJvbXZ4Y3B6b2J3cGt3ZXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwOTkwOTQsImV4cCI6MjA3ODY3NTA5NH0.FcIogKfFuCyxwyZBgQbLoQkincg9JmJ8CKCBf_X0XSA";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "family_photos";

/* ---------- MODAL CONTROL ---------- */
function openLoginModal() {
  loginModalBg.style.display = "flex";
}
function closeLoginModal() {
  loginModalBg.style.display = "none";
}

/* ---------- AUTH FUNCTIONS ---------- */
async function loginWithEmail() {
  const email = loginEmail.value;
  const pass = loginPassword.value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email, password: pass
  });

  if (error) return alert(error.message);

  closeLoginModal();
  loadUI();
}

async function registerWithEmail() {
  const email = loginEmail.value;
  const pass = loginPassword.value;

  const { error } = await supabaseClient.auth.signUp({
    email, password: pass
  });

  if (error) return alert(error.message);
  alert("Check your email to verify account!");
}

async function loginWithPhone() {
  const phone = loginPhone.value;

  const { error } = await supabaseClient.auth.signInWithOtp({ phone });

  if (error) return alert(error.message);

  alert("OTP sent (Test OTP = 123456)");
}

async function loginWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google"
  });
  if (error) alert(error.message);
}

btnSignOut.onclick = async () => {
  await supabaseClient.auth.signOut();
  loadUI();
};

/* ---------- UI UPDATE ---------- */
async function loadUI() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    btnSignOut.style.display = "none";
    authInfo.textContent = "";
    adminPanel.style.display = "none";
    return;
  }

  authInfo.textContent = user.email || user.phone;
  btnSignOut.style.display = "inline-block";

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  adminPanel.style.display = profile?.role === "admin" ? "block" : "none";
  loadAdminUsers();
}
/* ---------- FULLSCREEN VIEWER ---------- */
function openImageViewer(url) {
  document.getElementById("imageViewer").src = url;
  document.getElementById("imageViewerBg").style.display = "flex";
}

function closeImageViewer() {
  document.getElementById("imageViewerBg").style.display = "none";
}


/* ---------- PHOTO UPLOAD ---------- */
async function uploadPhoto() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return alert("Login first!");

  const file = fileInput.files[0];
  if (!file) return alert("Select a file");

  const album = albumInput.value || "uncategorized";
  const path = `${album}/${user.id}/${Date.now()}_${file.name}`;

  const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file);
  if (error) return alert(error.message);

  await supabaseClient.from("photos").insert({
    storage_path: path,
    album,
    filename: file.name,
    uploader: user.id,
    uploader_email: user.email
  });

  loadGallery();
  loadAlbums();
}

/* ---------- GALLERY ---------- */
async function loadGallery() {
  const { data } = await supabaseClient
    .from("photos")
    .select("*")
    .order("created_at", { ascending: false });

  gallery.innerHTML = "";

  data.forEach(p => {
    const url = supabaseClient.storage
      .from(BUCKET)
      .getPublicUrl(p.storage_path).data.publicUrl;

    gallery.innerHTML += `
      <div class="card">
        <img src="${url}" class="photo-img">
        <p>${p.filename}</p>
        <button class="top-btn" onclick="deletePhoto('${p.id}','${p.storage_path}')">Delete</button>
      </div>`;
  });
}

/* ---------- DELETE PHOTO ---------- */
async function deletePhoto(id, path) {
  await supabaseClient.storage.from(BUCKET).remove([path]);
  await supabaseClient.from("photos").delete().eq("id", id);
  loadGallery();
}

/* ---------- ALBUMS ---------- */
async function loadAlbums() {
  const { data } = await supabaseClient.from("photos").select("album");
  albums.innerHTML = "";

  const albumList = [...new Set(data.map(a => a.album))];
  albumList.forEach(a => {
    albums.innerHTML += `
      <button class="top-btn" onclick="filterAlbum('${a}')">${a}</button>`;
  });
}

async function filterAlbum(a) {
  const { data } = await supabaseClient
    .from("photos")
    .select("*")
    .eq("album", a);

  gallery.innerHTML = "";
  data.forEach(p => {
    const url = supabaseClient.storage
      .from(BUCKET)
      .getPublicUrl(p.storage_path).data.publicUrl;

    gallery.innerHTML += `
      <div class="card">
        <img src="${url}" class="photo-img">
        <p>${p.filename}</p>
      </div>`;
  });
}

/* ---------- ADMIN USERS ---------- */
async function loadAdminUsers() {
  const { data } = await supabaseClient.from("profiles").select("*");
  adminUsers.innerHTML = "";

  data.forEach(u => {
    adminUsers.innerHTML += `<p>${u.email} — <b>${u.role}</b></p>`;
  });
}

/* ---------- INIT ---------- */
loadUI();
loadGallery();
loadAlbums();
