// app.js — CORRECTED (no import syntax, works with UMD)

// -------------------------
// Supabase credentials
// -------------------------
const SUPABASE_URL = "https://brnromvxcpzobwpkwepy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybnJvbXZ4Y3B6b2J3cGt3ZXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwOTkwOTQsImV4cCI6MjA3ODY3NTA5NH0.FcIogKfFuCyxwyZBgQbLoQkincg9JmJ8CKCBf_X0XSA";

// -------------------------
// Initialize Supabase
// -------------------------
if (!window.supabase) {
  alert("Supabase failed to load. Check your network.");
}
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------
// Toast system
// -------------------------
export function toast(msg, ms = 3000) {
  const c = document.getElementById("toastContainer");
  if (!c) return console.log(msg);
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// -------------------------
// Auth helpers
// -------------------------
export async function requireAuth(redirect = true) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    if (redirect) window.location.href = "login.html";
    return null;
  }
  return data.user;
}

export async function signUpWithEmail(email, password) {
  return await supabase.auth.signUp({ email, password });
}

export async function signInWithPassword(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithMagicLink(email) {
  return await supabase.auth.signInWithOtp({ email });
}

export async function signInWithGoogle() {
  return await supabase.auth.signInWithOAuth({ provider: "google" });
}

export async function signInWithPhone(phone) {
  return await supabase.auth.signInWithOtp({ phone });
}

export async function verifyPhoneOtp(phone, token) {
  return await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

// -------------------------
// Storage helpers
// -------------------------
export const BUCKET = "photos";

export async function uploadFileForUser(userId, file) {
  const safeName = sanitizeFilename(file.name);
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  return { data, error, path };
}

export function getPublicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function listFilesForUser(userId) {
  return await supabase.storage.from(BUCKET).list(`${userId}/`, {
    limit: 500,
    sortBy: { column: "name", order: "desc" },
  });
}

export async function deleteFileForUser(userId, filename) {
  return await supabase.storage
    .from(BUCKET)
    .remove(`${userId}/${filename}`);
}

export function sanitizeFilename(s) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    }[c];
  });
}
