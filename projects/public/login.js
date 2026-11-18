document.querySelector("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button"),
    error = document.querySelector("#error");
  button.disabled = true;
  error.textContent = "";
  try {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    const next = new URLSearchParams(location.search).get('next');
    location.replace(next && /^\/marketing(?:\/|$)/.test(next) && !next.includes('\\') ? next : '/');
  } catch (e) {
    error.textContent = e.message;
  } finally {
    button.disabled = false;
  }
});
