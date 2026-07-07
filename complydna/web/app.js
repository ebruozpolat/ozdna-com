const CITATION_RE = /\[[^\]]+\]/g;
const API_KEY_STORAGE = "complydna_demo_api_key";
const DEFAULT_API_KEY = "complydna_sk_test_local";

const thread = document.getElementById("thread");
const form = document.getElementById("ask-form");
const input = document.getElementById("question-input");
const submitBtn = document.getElementById("submit-btn");
const sourcesBlock = document.getElementById("sources-block");
const sourcesList = document.getElementById("sources-list");
const sourcePanel = document.getElementById("source-panel");
const sourcePanelTitle = document.getElementById("source-panel-title");
const sourcePanelMeta = document.getElementById("source-panel-meta");
const sourcePanelText = document.getElementById("source-panel-text");
const sourcePanelClose = document.getElementById("source-panel-close");
const sourcePlaceholder = document.getElementById("source-placeholder");
const versionPill = document.getElementById("version-pill");
const apiKeyHint = document.getElementById("api-key-hint");

/** @type {Array<{citation: string, kaynak_kodu: string, score: number, metin: string, chunk_id: string}>} */
let latestSources = [];
let activeCitation = null;

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
}

function normalizeCitation(value) {
  return value.trim().replace(/\s+/g, " ");
}

function findSource(citation) {
  const needle = normalizeCitation(citation);
  return latestSources.find((item) => normalizeCitation(item.citation) === needle);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderAnswerWithChips(answer) {
  let lastIndex = 0;
  let html = "";
  for (const match of answer.matchAll(CITATION_RE)) {
    const start = match.index ?? 0;
    html += escapeHtml(answer.slice(lastIndex, start));
    const citation = match[0];
    html += `<button type="button" class="citation-chip" data-citation="${escapeHtml(citation)}">${escapeHtml(citation)}</button>`;
    lastIndex = start + citation.length;
  }
  html += escapeHtml(answer.slice(lastIndex));
  return html;
}

function setActiveCitation(citation) {
  activeCitation = citation;
  document.querySelectorAll(".citation-chip").forEach((node) => {
    node.classList.toggle(
      "is-active",
      node.dataset.citation === citation,
    );
  });
  document.querySelectorAll(".source-row").forEach((node) => {
    node.classList.toggle(
      "is-active",
      node.dataset.citation === citation,
    );
  });
}

function openSourcePanel(citation) {
  const source = findSource(citation);
  if (!source) {
    return;
  }

  setActiveCitation(citation);
  sourcePanel.setAttribute("aria-hidden", "false");
  sourcePanelTitle.textContent = source.citation;
  sourcePanelMeta.textContent = `${source.kaynak_kodu} · skor ${source.score.toFixed(3)} · ${source.chunk_id}`;
  sourcePanelText.textContent = source.metin;
  sourcePlaceholder.hidden = true;
}

function closeSourcePanel() {
  activeCitation = null;
  sourcePanel.setAttribute("aria-hidden", "true");
  sourcePanelTitle.textContent = "Madde metni";
  sourcePanelMeta.textContent = "";
  sourcePanelText.textContent = "";
  sourcePlaceholder.hidden = false;
  setActiveCitation(null);
}

function renderSources(sources) {
  latestSources = sources;
  sourcesList.replaceChildren();

  if (!sources.length) {
    sourcesBlock.hidden = true;
    return;
  }

  sourcesBlock.hidden = false;
  for (const source of sources) {
    const row = document.createElement("li");
    row.className = "source-row";
    row.dataset.citation = source.citation;
    row.innerHTML = `
      <span class="source-citation">${escapeHtml(source.citation)}</span>
      <span class="source-score">skor ${source.score.toFixed(3)}</span>
      <span class="source-snippet">${escapeHtml(source.metin)}</span>
    `;
    row.addEventListener("click", () => openSourcePanel(source.citation));
    sourcesList.appendChild(row);
  }
}

function appendTurn(question, answerHtml, isError = false) {
  const turn = document.createElement("div");
  turn.className = "turn";
  turn.innerHTML = `
    <div class="turn-label t-comment">// user query</div>
    <div class="turn-q"><span class="t-key">Q</span>: ${escapeHtml(question)}</div>
    <div class="turn-label t-comment">// cited response</div>
    <div class="turn-a ${isError ? "turn-error" : ""}"><span class="t-key">A</span>: ${answerHtml}</div>
  `;
  thread.appendChild(turn);
  turn.querySelectorAll(".citation-chip").forEach((chip) => {
    chip.addEventListener("click", () => openSourcePanel(chip.dataset.citation));
  });
  turn.scrollIntoView({ behavior: "smooth", block: "end" });
}

function showEmptyState() {
  thread.innerHTML = `
    <div class="thread-empty">
      <div class="t-comment">// ComplyDNA demo — her cümle künyeli yanıt</div>
      <div style="margin-top:0.5rem"><span class="t-key">hint</span>: örnek sorulardan birini seçin veya kendi sorunuzu yazın</div>
    </div>
  `;
}

async function askQuestion(question) {
  submitBtn.disabled = true;
  submitBtn.textContent = "…";

  try {
    const response = await fetch("/v1/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": getApiKey(),
      },
      body: JSON.stringify({ question }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = body.detail || response.statusText || "İstek başarısız";
      appendTurn(question, escapeHtml(String(detail)), true);
      return;
    }

    if (thread.querySelector(".thread-empty")) {
      thread.replaceChildren();
    }

    appendTurn(question, renderAnswerWithChips(body.answer));
    renderSources(body.sources || []);

    versionPill.hidden = false;
    versionPill.textContent = `index ${body.index_version} · model ${body.model_version}`;

    const firstCitation = body.citations?.[0]?.citation;
    if (firstCitation && findSource(firstCitation)) {
      openSourcePanel(firstCitation);
    }
  } catch (error) {
    appendTurn(question, escapeHtml(error.message || "Ağ hatası"), true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sor";
  }
}

async function loadHealth() {
  try {
    const response = await fetch("/health");
    if (!response.ok) {
      return;
    }
    const body = await response.json();
    versionPill.hidden = false;
    versionPill.textContent = `index ${body.index_version} · model ${body.model_version}`;
  } catch {
    // ignore
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) {
    return;
  }
  void askQuestion(question);
});

document.querySelectorAll(".example-chip").forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.dataset.question || "";
    input.value = question;
    input.focus();
    void askQuestion(question);
  });
});

sourcePanelClose.addEventListener("click", closeSourcePanel);

apiKeyHint.textContent = `X-API-Key: ${getApiKey()} (local dev)`;
showEmptyState();
void loadHealth();
