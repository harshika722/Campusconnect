// Har <input type="password"> ke paas show/hide (aankh) button lagata hai.
// Sirf input ka type badalta hai, isliye type kiya hua text waisa hi rehta hai.
(function () {
  var EYE =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
    '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
    '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function enhance(input) {
    if (input.getAttribute("data-pw-toggle") === "done") return;
    input.setAttribute("data-pw-toggle", "done");

    var wrap = document.createElement("div");
    wrap.className = "pw-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var btn = document.createElement("button");
    btn.type = "button"; // form submit nahi karna chahiye
    btn.className = "pw-toggle";
    if (input.id) btn.setAttribute("aria-controls", input.id);
    btn.setAttribute("aria-label", "Show password");
    btn.title = "Show password";
    btn.innerHTML = EYE;
    wrap.appendChild(btn);

    btn.addEventListener("click", function () {
      var hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      var label = hidden ? "Hide password" : "Show password";
      btn.setAttribute("aria-label", label);
      btn.title = label;
      btn.innerHTML = hidden ? EYE_OFF : EYE;
    });
  }

  var inputs = document.querySelectorAll('input[type="password"]');
  for (var i = 0; i < inputs.length; i++) enhance(inputs[i]);
})();