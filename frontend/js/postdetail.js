// ===== 1. Post id URL se lo (postdetail.html?id=123) =====
const postId = new URLSearchParams(window.location.search).get("id");

// ===== 2. Elements =====
const navLinks = document.getElementById("navLinks");
const message = document.getElementById("message");
const postBox = document.getElementById("postBox");
const contactBox = document.getElementById("contactBox");
const commentsSection = document.getElementById("commentsSection");
const commentForm = document.getElementById("commentForm");
const commentList = document.getElementById("commentList");

let currentPost = null;
let isOwner = false;

// ===== 3. Helpers =====
function safe(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// Logged-in user ko localStorage se nikalo (saveLogin ne yahin rakha tha)
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch (e) {
    return null;
  }
}
function myId() {
  const u = getUser();
  return u ? String(u.id || u._id) : null;
}

// Kisi bhi object (user ya id string) se id nikalo
function idOf(x) {
  if (!x) return null;
  if (typeof x === "object") return String(x._id || x.id);
  return String(x);
}

// Post ka owner kaun hai (backend ka field naam alag ho sakta hai)
function getOwnerId(post) {
  return idOf(post.user || post.owner || post.author || post.postedBy || post.createdBy);
}

// ===== 4. Navbar =====
function buildNavbar() {
  if (getToken()) {
    navLinks.innerHTML = `
      <a href="createpost.html" class="primary">+ New Post</a>
      <a href="dashboard.html">Dashboard</a>
      <button id="logoutBtn">Logout</button>`;
    document.getElementById("logoutBtn").addEventListener("click", () => {
      logout();
      window.location.href = "login.html";
    });
  } else {
    navLinks.innerHTML = `
      <a href="login.html">Login</a>
      <a href="signup.html" class="primary">Sign Up</a>`;
  }
}

// ===== 5. Post dikhao =====
function showPost(post) {
  const date = post.date ? new Date(post.date).toLocaleDateString() : "N/A";
  const resolved = post.status === "resolved" ? `<span class="badge resolved">Resolved</span>` : "";
  const price = post.category === "resource"
    ? `<span>${post.price ? "₹" + safe(post.price) : "Free"}</span>`
    : "";
  const tags = (post.tags || []).map((t) => `<span class="tag">#${safe(t)}</span>`).join("");
  const posterName = post.postedBy && post.postedBy.name ? post.postedBy.name : "";
  const image = post.photoUrl
    ? `<img class="detail-img" src="${safe(post.photoUrl)}" alt="post photo" onerror="this.remove()" />`
    : "";
  // Owner ko edit hint, baaki logon ko Report button
  let actions = "";
  if (isOwner) {
    actions = `<a class="btn" href="dashboard.html">Manage this post in Dashboard</a>`;
  } else if (getToken()) {
    actions = `<button class="btn danger" id="reportBtn">Report this post</button>`;
  }

  postBox.innerHTML = `
    ${image}
    <div class="detail-body">
      <span class="badge ${safe(post.category)}">${safe(post.category)}</span>${resolved}
      <h1>${safe(post.title)}</h1>
      <p class="detail-desc">${safe(post.description)}</p>
      <div class="detail-info">
        <span>Location: ${safe(post.location || "N/A")}</span>
        <span>${date}</span>
        ${price}
        ${posterName ? `<span> ${safe(posterName)}</span>` : ""}
      </div>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      ${actions ? `<div class="detail-actions">${actions}</div>` : ""}
    </div>`;
  postBox.classList.remove("hidden");

  const reportBtn = document.getElementById("reportBtn");
  if (reportBtn) reportBtn.addEventListener("click", reportPost);
}

// ===== 6. Report =====
async function reportPost() {
  const reason = prompt("Why are you reporting this post?");
  if (!reason || !reason.trim()) return;
  try {
    await api(`/posts/${postId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    alert("Thanks, the post has been reported.");
  } catch (err) {
    alert(err.message || "Could not report the post.");
  }
}

// ===== 7. Comment form =====
function showCommentForm() {
  if (!getToken()) {
    commentForm.innerHTML = `<p class="login-hint"><a href="login.html">Login</a> to comment or claim this post.</p>`;
    return;
  }

    const claimLabels = {
    lost: "I found this item (send a claim)",
    found: "This is my item (send a claim)",
    resource: "I want this resource (send a request)",
  };
  const claimLabel = claimLabels[currentPost.category] || "Send a claim";

  // Owner apni hi post par claim nahi kar sakta
  const claimRow = isOwner
    ? ""
    : `<label class="check-row"><input type="checkbox" id="isClaim" /> ${claimLabel}</label>`;

  commentForm.innerHTML = `
    <textarea id="commentText" rows="3" placeholder="Write a comment..."></textarea>
    ${claimRow}
    <p id="commentError" class="form-message error"></p>
    <button class="submit-btn" id="commentBtn">Post</button>`;

  document.getElementById("commentBtn").addEventListener("click", sendComment);
}

async function sendComment() {
  const text = document.getElementById("commentText").value.trim();
  const claimBox = document.getElementById("isClaim");
  const isClaim = claimBox ? claimBox.checked : false;
  const errorBox = document.getElementById("commentError");
  const btn = document.getElementById("commentBtn");

  if (!text) {
    errorBox.textContent = "Please write something first.";
    return;
  }

  btn.disabled = true;
  errorBox.textContent = "";

  try {
    await api(`/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, isClaim }),
    });
    document.getElementById("commentText").value = "";
    if (claimBox) claimBox.checked = false;
    await loadComments();
  } catch (err) {
    errorBox.textContent = err.message || "Could not post comment.";
  }
  btn.disabled = false;
}

// ===== 8. Comments load + dikhao =====
async function loadComments() {
  try {
    const data = await api(`/posts/${postId}/comments`);
    const comments = Array.isArray(data) ? data : data.comments || [];
    renderComments(comments);
  } catch (err) {
    commentList.innerHTML = `<p class="message">Could not load comments.</p>`;
  }
}

function renderComments(comments) {
  if (comments.length === 0) {
    commentList.innerHTML = `<p class="message">No comments yet. Be the first!</p>`;
  } else {
    commentList.innerHTML = comments.map(makeComment).join("");
  }

  // Backend claims sirf poster aur claimer ko bhejta hai,
  // isliye non-owner ko approved claim dikhe toh wo uska apna hi hai
  const myApproved = comments.some(
    (c) => c.isClaim && (c.status || c.claimStatus) === "approved"
  );
  if (!isOwner && myApproved) showContactButton();
}

function makeComment(c) {
  const name = (c.userId && c.userId.name) || (c.user && c.user.name) || c.userName || "Deleted user";
  const time = c.createdAt ? new Date(c.createdAt).toLocaleString() : "";
  const status = c.status || c.claimStatus || "pending";

  let tag = "";
  let actions = "";

  if (c.isClaim) {
    tag = `<span class="claim-tag ${status}">CLAIM · ${safe(status)}</span>`;
    // Sirf post owner ko approve/reject dikhega, jab tak pending hai
    if (isOwner && status === "pending") {
      actions = `
        <div class="claim-actions">
          <button class="btn good" data-action="approved" data-id="${c._id}">Approve</button>
          <button class="btn danger" data-action="rejected" data-id="${c._id}">Reject</button>
        </div>`;
    }
  }

  return `
    <div class="comment ${c.isClaim ? "claim" : ""}">
      <div class="comment-head">
        <span><b>${safe(name)}</b>${tag}</span>
        <span>${time}</span>
      </div>
      <p>${safe(c.text)}</p>
      ${actions}
    </div>`;
}

// Approve / Reject buttons (event delegation)
commentList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  btn.disabled = true;
  try {
    await api(`/comments/${btn.dataset.id}/claim`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: btn.dataset.action }),
    });
    await loadComments();
  } catch (err) {
    alert(err.message || "Could not update the claim.");
    btn.disabled = false;
  }
});

// ===== 9. Contact reveal =====
function showContactButton() {
  contactBox.innerHTML = `
    <strong>Your claim was approved! </strong>
    <p style="margin:8px 0 12px;color:var(--muted)">You can now see the poster's contact details.</p>
    <button class="btn primary" id="contactBtn">Show contact</button>`;
  contactBox.classList.remove("hidden");

  document.getElementById("contactBtn").addEventListener("click", async () => {
    try {
      const data = await api(`/posts/${postId}/contact`);
      const contact = data.contact || (data.user && data.user.contact) || JSON.stringify(data);
      contactBox.innerHTML = `<strong>Poster's contact:</strong> <span>${safe(contact)}</span>`;
    } catch (err) {
      alert(err.message || "Could not get contact.");
    }
  });
}

// ===== 10. Page start =====
async function init() {
  buildNavbar();

  if (!postId) {
    message.textContent = "Post not found.";
    return;
  }

  message.textContent = "Loading...";
  try {
    const data = await api(`/posts/${postId}`);
    currentPost = data.post || data;
    isOwner = !!getToken() && getOwnerId(currentPost) === myId();

    message.textContent = "";
    showPost(currentPost);
    commentsSection.classList.remove("hidden");
    showCommentForm();
    await loadComments();
  } catch (err) {
    message.textContent = "Could not load this post.";
    console.error(err);
  }
}

init();