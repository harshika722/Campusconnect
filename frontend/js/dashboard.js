// ===== 1. Login check =====
if (!getToken()) {
  window.location.href = "login.html";
}

// ===== 2. Elements =====
const welcome = document.getElementById("welcome");
const message = document.getElementById("message");
const myPosts = document.getElementById("myPosts");
const contactInput = document.getElementById("contactInput");
const contactMsg = document.getElementById("contactMsg");

const modal = document.getElementById("editModal");
const editMsg = document.getElementById("editMsg");
let editingId = null;      // abhi kaunsi post edit ho rahi hai
let postsCache = [];       // saari posts yaad rakho (edit ke time kaam aayega)

// ===== 3. Helpers =====
function safe(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch (e) {
    return null;
  }
}

// ===== 4. Logout + welcome =====
document.getElementById("logoutBtn").addEventListener("click", () => {
  logout();
  window.location.href = "login.html";
});

const user = getUser();
if (user && user.name) welcome.textContent = "Hi, " + user.name ;

// ===== 5. Contact save =====
// Backend login mein contact wapas nahi bhejta, isliye last saved value
// browser mein yaad rakh rahe hain taaki box khali na dikhe.
contactInput.value = localStorage.getItem("campusContact") || "";

document.getElementById("saveContactBtn").addEventListener("click", async () => {
  const contact = contactInput.value.trim();
  if (!contact) {
    contactMsg.textContent = "Please enter your contact first.";
    contactMsg.className = "form-message error";
    return;
  }

  try {
    await api("/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact }),
    });
    localStorage.setItem("campusContact", contact);
    contactMsg.textContent = "Contact saved!";
    contactMsg.className = "form-message success";
  } catch (err) {
    contactMsg.textContent = err.message || "Could not save contact.";
    contactMsg.className = "form-message error";
  }
});

// ===== 6. My posts load =====
async function loadMyPosts() {
  message.textContent = "Loading...";
  try {
    const data = await api("/posts/mine");
    postsCache = Array.isArray(data) ? data : data.posts || [];

    if (postsCache.length === 0) {
      myPosts.innerHTML = "";
      message.innerHTML = `You have no posts yet. <a href="createpost.html" style="color:var(--cyan)">Create one</a>`;
      return;
    }

    message.textContent = "";
    myPosts.innerHTML = postsCache.map(makeRow).join("");
  } catch (err) {
    message.textContent = "Could not load your posts.";
    console.error(err);
  }
}

function makeRow(p) {
  const id = p._id || p.id;
  const isResolved = p.status === "resolved";
  const date = p.date ? new Date(p.date).toLocaleDateString() : "";

  return `
    <div class="my-post">
      <div class="my-post-info">
        <span class="badge ${safe(p.category)}">${safe(p.category)}</span>
        ${isResolved ? `<span class="badge resolved">Resolved</span>` : ""}
        <h4><a href="postdetail.html?id=${id}">${safe(p.title)}</a></h4>
        <small>${safe(p.location || "N/A")} &nbsp;|&nbsp; ${date}</small>
      </div>
      <div class="my-post-actions">
        <button class="btn good" data-act="status" data-id="${id}" data-status="${isResolved ? "open" : "resolved"}">
          ${isResolved ? "Reopen" : "Mark resolved"}
        </button>
        <button class="btn" data-act="edit" data-id="${id}">Edit</button>
        <button class="btn danger" data-act="delete" data-id="${id}">Delete</button>
      </div>
    </div>`;
}

// ===== 7. Buttons (event delegation) =====
myPosts.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;

  const id = btn.dataset.id;
  const act = btn.dataset.act;

  if (act === "status") {
    try {
      await api(`/posts/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: btn.dataset.status }),
      });
      loadMyPosts();
    } catch (err) {
      alert(err.message || "Could not update status.");
    }
  }

  if (act === "delete") {
    if (!confirm("Delete this post permanently?")) return;
    try {
      await api(`/posts/${id}`, { method: "DELETE" });
      loadMyPosts();
    } catch (err) {
      alert(err.message || "Could not delete the post.");
    }
  }

  if (act === "edit") {
    openEdit(id);
  }
});

// ===== 8. Edit popup =====
function openEdit(id) {
  const p = postsCache.find((x) => String(x._id || x.id) === String(id));
  if (!p) return;

  editingId = id;
  editMsg.textContent = "";

  document.getElementById("eTitle").value = p.title || "";
  document.getElementById("eDescription").value = p.description || "";
  document.getElementById("eLocation").value = p.location || "";
  document.getElementById("eDate").value = p.date ? String(p.date).slice(0, 10) : "";
  document.getElementById("ePrice").value = p.price || 0;
  document.getElementById("ePhoto").value = p.photoUrl || "";
  document.getElementById("eTags").value = (p.tags || []).join(", ");

  // Price sirf resource ke liye
  const priceBox = document.getElementById("ePriceBox");
  if (p.category === "resource") priceBox.classList.remove("hidden");
  else priceBox.classList.add("hidden");

  modal.classList.remove("hidden");
}

function closeEdit() {
  modal.classList.add("hidden");
  editingId = null;
}

document.getElementById("cancelEdit").addEventListener("click", closeEdit);

// Popup ke bahar click karne par band
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeEdit();
});

document.getElementById("saveEdit").addEventListener("click", async () => {
  const p = postsCache.find((x) => String(x._id || x.id) === String(editingId));
  if (!p) return;

  const title = document.getElementById("eTitle").value.trim();
  const description = document.getElementById("eDescription").value.trim();
  if (!title || !description) {
    editMsg.textContent = "Title and description are required.";
    return;
  }

  const tags = document.getElementById("eTags").value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");

  const body = {
    title,
    description,
    category: p.category, // category change nahi hoti
    location: document.getElementById("eLocation").value.trim(),
    date: document.getElementById("eDate").value,
    price: p.category === "resource" ? Number(document.getElementById("ePrice").value) : 0,
    photoUrl: document.getElementById("ePhoto").value.trim(),
    tags,
  };

  try {
    await api(`/posts/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    closeEdit();
    loadMyPosts();
  } catch (err) {
    editMsg.textContent = err.message || "Could not save changes.";
  }
});

// ===== 9. Page start =====
loadMyPosts();