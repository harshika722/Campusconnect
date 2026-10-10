const API_URL = "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("token");
}

function saveLogin(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;

  const res = await fetch(API_URL + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}