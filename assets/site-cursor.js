const canUseCustomCursor = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (canUseCustomCursor) {
  const cursor = document.createElement("span");
  cursor.className = "site-cursor";
  cursor.setAttribute("aria-hidden", "true");
  document.body.appendChild(cursor);
  document.body.classList.add("has-custom-cursor");

  const interactiveSelector = "a, button, input, textarea, select, label, video, .media-full img, .media-item img, .illustration-item img, .book-item img";

  window.addEventListener("mousemove", (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add("is-visible");
    cursor.classList.toggle("is-hovering", Boolean(event.target.closest(interactiveSelector)));
  });

  document.addEventListener("mousedown", () => cursor.classList.add("is-pressing"));
  document.addEventListener("mouseup", () => cursor.classList.remove("is-pressing"));
  document.addEventListener("mouseleave", () => cursor.classList.remove("is-visible", "is-hovering", "is-pressing"));
}
