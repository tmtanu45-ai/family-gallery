// app.js — main application logic (module)
// Replace these values with your project values (already set for you)
export const SUPABASE_URL = "https://brnromvxcpzobwpkwepy.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybnJvbXZ4Y3B6b2J3cGt3ZXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwOTkwOTQsImV4cCI6MjA3ODY3NTA5NH0.FcIogKfFuCyxwyZBgQbLoQkincg9JmJ8CKCBf_X0XSA";

// Note: app.js is written as a module and must be loaded with type="module".
// It exports helpers used by pages. Pages may import specific functions.
import { createClient } from "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utilities
export function toast(msg, duration = 3500) {
  const wrap = document.getElementById("toastContainer");
  if (!wrap) return console.log("Toast:", msg);
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export async function requireAuth(redirect = true) {
  // returns user or null (and optionally redirects)
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn("getUser error", error);
    if (redirect) window.location.href = "login.html";
    return null;
  }
  if (!data?.user) {
    if (redirect) window.location.href = "login.html";
    return null;
  }
  return data.user;
}

export async function signUpWithEmail(email, password) {
  // sign up (email confirm link if enabled in Supabase)
  return await supabase.auth.signUp({ email, password });
}

export async function signInWithPassword(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithMagicLink(email) {
  return await supabase.auth.signInWithOtp({ email });
}

export async function signInWithGoogle() {
  // will redirect to provider
  return await supabase.auth.signInWithOAuth({ provider: "google" });
}

export async function signInWithPhone(phone) {
  return await supabase.auth.signInWithOtp({ phone });
}

export async function verifyPhoneOtp(phone, token) {
  return await supabase.auth.verifyOtp({ phone, token, type: "sms" });
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

// Storage helpers (bucket "photos")
export const BUCKET = "photos";

export async function uploadFileForUser(userId, file) {
  const safeName = sanitizeFilename(file.name);
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  return { data, error, path };
}

export function getPublicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function listFilesForUser(userId) {
  const { data, error } = await supabase.storage.from(BUCKET).list(`${userId}/`, { limit: 500, sortBy: { column: "name", order: "desc" } });
  return { data, error };
}

export async function deleteFileForUser(userId, name) {
  return await supabase.storage.from(BUCKET).remove(`${userId}/${name}`);
}

export async function createSignedUrl(path, expiresIn = 60) {
  // use for private buckets — returns { data, error }
  return await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
}

export function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9\.\-\_]/g, "_");
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s]);
}
