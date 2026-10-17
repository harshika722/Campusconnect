// ===== 1. Grab elements =====
const navLinks = document.getElementById("navLinks");
const postGrid = document.getElementById("postGrid");
const message = document.getElementById("message");
const searchInput = document.getElementById("searchInput");
const filters = document.getElementById("filters");

// Currently selected category
let currentCategory = "all";

// ===== 2. Build navbar (depends on whether user is logged in) =====
function buildNavbar() {
  if (getToken()) {
    navLinks.innerHTML = `
      <a href="createpost.html" class="primary">+ New Post</a>
      <a href="dashboard.html">Dashboard</a>
      <button id="logoutBtn">Logout</button>
    `;
    document.getElementById("logoutBtn").addEventListener("click", () => {
      logout(); // function from api.js
      window.location.href = "login.html";
    });
  } else {
    navLinks.innerHTML = `
      <a href="login.html">Login</a>
      <a href="signup.html" class="primary">Sign Up</a>
    `;
  }
}

// ===== 3. Security helper: make user text safe =====
// (so that a title containing <script> cannot break the page)
function safe(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function makeCard(post) {
  const id = post._id || post.id;

  const image = post.photoUrl
    ? `<img class="card-img" src="${safe(post.photoUrl)}" alt="post photo" onerror="this.outerHTML='<div class=&quot;card-img placeholder&quot;>${safe(post.category).toUpperCase()}</div>'" />`
    : `<div class="card-img placeholder">${safe(post.category).toUpperCase()}</div>`;

  const date = post.date ? new Date(post.date).toLocaleDateString() : "";
  const price = post.category === "resource" && post.price
    ? `₹${safe(post.price)}`
    : "";
  const resolved = post.status === "resolved"
    ? `<span class="badge resolved">Resolved</span>`
    : "";

  return `
    <a class="card" href="postdetail.html?id=${id}">
      ${image}
      <div class="card-body">
        <span class="badge ${safe(post.category)}">${safe(post.category)}</span>${resolved}
        <h3>${safe(post.title)}</h3>
        <p>${safe((post.description || "").slice(0, 80))}${(post.description || "").length > 80 ? "..." : ""}</p>
        <div class="meta">
          <span>${safe(post.location || "N/A")}</span>
          <span>${price || date}</span>
        </div>
      </div>
    </a>
  `;
}

// ===== 5. Fetch posts from backend and show them =====
async function loadPosts() {
  message.textContent = "Loading...";
  postGrid.innerHTML = "";

  const search = searchInput.value.trim();
  const query = `?category=${currentCategory}&search=${encodeURIComponent(search)}`;

  try {
    const data = await api("/posts" + query);
    // works whether backend sends an array or {posts: [...]}
    const posts = Array.isArray(data) ? data : data.posts || [];

    if (posts.length === 0) {
      message.textContent = "No posts found";
      return;
    }

    message.textContent = "";
    postGrid.innerHTML = posts.map(makeCard).join("");
  } catch (err) {
    message.textContent = "Could not load posts. Is the backend running?";
    console.error(err);
  }
}

// ===== 6. Filter buttons =====
filters.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;

  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  btn.classList.add("active");

  currentCategory = btn.dataset.cat;
  loadPosts();
});

// ===== 7. Search (wait until the user stops typing) =====
let timer;
searchInput.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(loadPosts, 400); // wait 0.4 sec
});

// ===== 8. Run when the page opens =====
buildNavbar();
loadPosts();