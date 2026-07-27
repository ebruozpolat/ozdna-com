import { verifyC2pa } from "./c2pa-verify.js";

const input = document.querySelector<HTMLInputElement>("#file")!;
const prompt = document.querySelector("#prompt")!;
const status = document.querySelector<HTMLElement>("#status")!;
const raw = document.querySelector<HTMLPreElement>("#raw")!;

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;
  prompt.textContent = `${file.name} · ${Math.round(file.size / 1024)} KB`;
  status.innerHTML = `<span class="hold">Reading C2PA Wasm…</span>`;
  raw.style.display = "none";
  raw.textContent = "";

  const result = await verifyC2pa(file);
  if (!result.ok) {
    status.innerHTML = `<span class="bad">${escapeHtml(result.summary)}</span>`;
    if ("error" in result && result.error) {
      raw.textContent = result.error;
      raw.style.display = "block";
    }
    return;
  }
  if (result.hasManifest) {
    status.innerHTML = `<span class="ok">${escapeHtml(result.summary)}</span>`;
    raw.textContent = JSON.stringify(result.raw, null, 2);
    raw.style.display = "block";
  } else {
    status.innerHTML = `<span class="hold">${escapeHtml(result.summary)}</span>`;
  }
});

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
