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
  localStorage.removeItem("campusContact"); // shared computer par agle user ko tumhara number na dikhe
  window.location.href = "login.html";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;

  let res;
  try {
    res = await fetch(API_URL + path, { ...options, headers });
  } catch (e) {
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }

  // Server ne JSON ki jagah kuch aur bheja (jaise HTML error page) toh crash mat karo
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    data = {};
  }

  // Token bheja par server ne reject kiya (expired/kharab): purana login hata do
  if (res.status === 401 && token) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!res.ok) throw new Error(data.message || "Something went wrong (" + res.status + ")");
  return data;
}