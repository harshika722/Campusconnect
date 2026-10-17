// ===== 1. Login check: bina login ke is page par nahi aa sakte =====
if (!getToken()) {
  window.location.href = "login.html";
}

// ===== 2. Elements =====
const form = document.getElementById("postForm");
const categorySelect = document.getElementById("category");
const priceBox = document.getElementById("priceBox");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");

// ===== 3. Price box sirf "resource" par dikhao =====
function togglePrice() {
  if (categorySelect.value === "resource") {
    priceBox.classList.remove("hidden");
  } else {
    priceBox.classList.add("hidden");
  }
}
categorySelect.addEventListener("change", togglePrice);
togglePrice();

// ===== 4. Message dikhane ka helper =====
function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = "form-message " + type;
}

// ===== 5. Form submit =====
form.addEventListener("submit", async (e) => {
  e.preventDefault(); // page reload hone se roko

  const category = categorySelect.value;

  // Tags: "a, b, c" -> ["a", "b", "c"]
  const tags = document.getElementById("tags").value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");

  // Backend ko jo data bhejna hai
  const body = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    category: category,
    location: document.getElementById("location").value.trim(),
    date: document.getElementById("date").value,
    price: category === "resource" ? Number(document.getElementById("price").value) : 0,
    photoUrl: document.getElementById("photoUrl").value.trim(),
    tags: tags,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Publishing...";
  showMessage("", "");

  try {
    await api("/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    showMessage("Post published! Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  } catch (err) {
    showMessage(err.message || "Could not publish the post.", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Publish Post";
  }
});