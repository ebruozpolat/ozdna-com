import { usablePdq } from "@ozdna/dna-core";
import { initPdqBrowser, pdqHashBlobBrowser } from "@ozdna/dna-core/pdq-browser";
import { verifyC2pa } from "./c2pa-verify.js";

const input = document.querySelector<HTMLInputElement>("#file")!;
const prompt = document.querySelector("#prompt")!;
const status = document.querySelector<HTMLElement>("#status")!;
const raw = document.querySelector<HTMLPreElement>("#raw")!;

const wasmUrl = `${import.meta.env.BASE_URL}pdq.wasm`;
void initPdqBrowser({ wasmUrl }).catch((err) => {
  console.warn("PDQ init failed (C2PA verify still works):", err);
});

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;
  prompt.textContent = `${file.name} · ${Math.round(file.size / 1024)} KB`;
  status.innerHTML = `<span class="hold">Reading C2PA Wasm + PDQ…</span>`;
  raw.style.display = "none";
  raw.textContent = "";

  let pdqBlock: Record<string, unknown> | null = null;
  try {
    await initPdqBrowser({ wasmUrl });
    const pdq = await pdqHashBlobBrowser(file);
    const usable = usablePdq(pdq);
    pdqBlock = {
      hex: pdq.hex,
      quality: pdq.quality,
      usable: usable != null,
      note: usable
        ? "Usable for §1.5 confirmation (quality ≥ 50)."
        : "Quality too low — treated as absent for confirmation.",
    };
  } catch (err) {
    pdqBlock = { error: err instanceof Error ? err.message : String(err) };
  }

  const result = await verifyC2pa(file);
  const payload = { c2pa: result, pdq: pdqBlock };

  if (!result.ok) {
    status.innerHTML = `<span class="bad">${escapeHtml(result.summary)}</span>`;
    raw.textContent = JSON.stringify(payload, null, 2);
    raw.style.display = "block";
    return;
  }
  const cls = result.hasManifest ? "ok" : "hold";
  const pdqNote =
    pdqBlock && "hex" in pdqBlock
      ? ` · PDQ ${String(pdqBlock.hex).slice(0, 12)}… (q=${pdqBlock.quality})`
      : "";
  status.innerHTML = `<span class="${cls}">${escapeHtml(result.summary)}${escapeHtml(pdqNote)}</span>`;
  raw.textContent = JSON.stringify(payload, null, 2);
  raw.style.display = "block";
});

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
