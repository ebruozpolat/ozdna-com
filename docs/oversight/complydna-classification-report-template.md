<!--
complyDNA — AI Act classification report · TEMPLATE
Audit deliverable for the oversight product line (ozdna.com/oversight).
Fill the {{PLACEHOLDERS}} and the classification table, then export.
Content rules (docs/oversight/website-spec.md): verbs implements / operationalises /
evidences / supports; NO absolute "guarantee/ensure compliance" language; no competitor
names; re-verify AI Act dates before sending (see ai-act-mapping.md). Not legal advice.
A Turkish version can be produced from this template on request.
-->

# complyDNA — AI Act Classification Report

| | |
|---|---|
| **Prepared for** | {{CLIENT_ORG}} — {{CLIENT_CONTACT}} ({{ROLE, e.g. Compliance Officer / CTO}}) |
| **Prepared by** | {{PREPARER}} |
| **Date** | {{YYYY-MM-DD}} |
| **Scope** | {{SYSTEMS / WORKFLOWS IN SCOPE}} |
| **Basis** | EU AI Act (risk-based approach); ozDNA runtime mapping — see `ai-act-mapping.md` |

> This report **classifies** the AI systems in scope onto a risk tier and shows how each
> obligation would be **implemented, operationalised and evidenced** in runtime. It makes
> **no absolute compliance claim**; the compliance determination rests with the deployer and
> its regulator. AI Act article numbers and application dates are current as of the report
> date and should be re-verified before any binding use.

## 1. Executive summary
{{2–4 sentences: what was assessed, the headline risk picture, and the single most
important recommended action. Keep it CFO-and-compliance-officer legible.}}

## 2. Method
Each workload is placed on a **risk tier** by the DT 5.0 classifier (AI Act **Art. 9**,
continuous/lifecycle risk management), which determines routing:
- **Low** → cheapest sufficient model; logged.
- **Elevated** → stronger model; logged for traceability.
- **High** → escalated to the **Council** (multi-model vote + veto + fail-closed judge —
  **Art. 14** human oversight) before the decision stands.
Every decision, its votes, rationale and outcome are written to an append-only, hash-chained
**Ledger** (**Art. 12** record-keeping) and rendered as an **Attestation** for a deployer or
auditor (**Art. 13** transparency).

## 3. Classification table
| # | Workload / decision | Data & stakes | Risk tier | AI Act article(s) | Runtime control | Evidence |
|---|---|---|---|---|---|---|
| 1 | {{workload}} | {{what it decides, who it affects}} | Low / Elevated / High | Art. 9 / 14 | route / Council | Ledger + Attestation |
| 2 | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} |
| 3 | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} |

## 4. High-risk decisions → oversight (Art. 14)
{{List the workloads classified High and describe the Council configuration: which models
vote, what triggers a veto, and the fail-closed default. State that a human owner holds the
last word on any held decision.}}

## 5. Record-keeping & transparency (Art. 12 / 13)
{{Describe what the Ledger records per decision and what the Attestation exposes to an
auditor. Note append-only + hash-chaining make later edits detectable.}}

## 6. Regulatory timeline (re-verify before sending)
| Obligation | Applies | Relevance to {{CLIENT_ORG}} |
|---|---|---|
| Art. 50 transparency duties | 2 Aug 2026 | {{…}} |
| Annex III high-risk areas | 2 Dec 2027 | {{main preparation window}} |
| Systems embedded in regulated products | 2 Aug 2028 | {{secondary}} |

## 7. Recommendations
1. {{Highest-leverage step — usually: route the High-tier workloads through the Council first.}}
2. {{Evidence gap to close — stand up the Ledger/Attestation for the audited decisions.}}
3. {{Sequencing toward the client's own compliance date.}}

## 8. Next step
A scoped pilot turns this classification into a live runtime for the High-tier workloads,
producing real attestations an auditor can read. Request via `ozdna.com/oversight/#audit`.

---
*ozDNA — AI oversight infrastructure. complyDNA implements, operationalises and evidences the
obligations described; it does not make an absolute compliance claim. Not legal advice.*
