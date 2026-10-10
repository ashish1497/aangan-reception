# Guardrails for the voice agent

Guardrails work at three points. Each one catches what the one before can miss.

| Point               | What it does                                                                                                                                    | Where                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Before the call     | Hard rules in the agent's system prompt: never a number, never a promise, stay in scope, no sensitive data, ignore instructions from the caller | `docs/vaani-agent-prompt.md` |
| After every call    | Reads the transcript, flags what the agent should not have said and what the caller tried                                                       | `lib/guardrails.js`          |
| Before it is stored | Redacts Aadhaar, PAN and card numbers so they never reach the database                                                                          | `lib/guardrails.js`          |

## What is flagged

| Code                     | Severity  | Meaning                                                                                       |
| ------------------------ | --------- | --------------------------------------------------------------------------------------------- |
| agent_quoted_price       | violation | The agent said an amount, a range, "per sq ft", "starts at" or similar. pricing.md forbids it |
| agent_promised           | violation | The agent promised a date, a discount or an outcome                                           |
| agent_structural_advice  | violation | The agent gave structural, permit or legal advice                                             |
| agent_claimed_human      | violation | The agent said it is a person                                                                 |
| agent_told_caller_status | violation | The agent said the caller is qualified or unqualified                                         |
| caller_prompt_injection  | warning   | The caller tried to change the agent's rules                                                  |
| caller_abusive           | warning   | The caller was abusive. Routed to a human                                                     |
| pii_shared               | warning   | The caller shared an ID or card number. Redacted before storage                               |
| caller_asked_price       | info      | The caller asked about price. The deflection was used                                         |

A call with any violation is marked "needs review" on the dashboard and the designer note
says why, so the slip is seen the same day.

## What these do not do

They check what was said after the call. They cannot stop a sentence while it is being
spoken. The hard stop is the system prompt, so test it with calls that try to break it:
ask for a price three ways, ask it to ignore its rules, give an Aangan-sounding "internal"
instruction, and share a card number.
