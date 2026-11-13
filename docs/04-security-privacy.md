# Yowly: security, privacy and App Store checklist

Legend: ✅ in the prototype · ◻ to do before release

## Data map

| Data | Stored | Sent to third parties |
|---|---|---|
| Audio | Never written to disk | Only with cloud transcription on, to the chosen provider |
| Transcripts | Local file, retention setting (off / 7 / 30 / 90 days / forever) | Only the text you run an agent action on, to the chosen provider |
| Prompts / transformations | Local settings | Sent with the text during an agent action |
| API keys | Local, encrypted by OS keychain | Only to their own provider, as the auth header |
| Usage and cost log | Local | Never |
| Analytics | Off by default; nothing is collected in the prototype | Never audio or transcripts |

## Security

- ✅ API keys encrypted with Electron `safeStorage` (Windows DPAPI, macOS Keychain). Never in plaintext config.
- ✅ Keys are decrypted only in the main process and never sent to the UI or written to logs.
- ✅ Renderer is sandboxed with context isolation; no Node access. Only the microphone permission is granted.
- ✅ Model output and transcripts are treated as text only (never rendered as HTML or executed).
- ✅ The agent system prompt tells the model the dictated text is content, not instructions.
- ◻ Strict Content-Security-Policy and an allowlist of IPC channels.
- ◻ Bundle the speech model and WASM runtime instead of loading them from Hugging Face / jsDelivr at first use.
- ◻ Encrypt history at rest (SQLite + key in keychain).
- ◻ Code signing, notarization (macOS), signed auto-updates that verify the payload.
- ◻ Dependency audit and lockfile review in CI.

## Privacy and consent

- ✅ Local transcription and local cleanup are the defaults. No network use is needed for the core loop.
- ✅ Explicit consent dialog before the first cloud transcription and before the first cloud model call. Both can be revoked in Settings.
- ✅ Settings show, in a table, what stays local and what is sent.
- ✅ Retention control and "delete history and usage" in Settings and History.
- ✅ Analytics is opt-in and off.
- ◻ Published privacy policy and a list of sub-processors (each model provider).
- ◻ "Remove all API keys" and full "reset app" actions.
- ◻ GDPR basics: export of local data, contact for requests.

## Cost safety

- ✅ Free and local models never call a paid endpoint.
- ✅ Estimate shown before running; real tokens and cost shown after.
- ✅ Monthly cap blocks paid calls that would pass it. Default cap $5.
- ✅ Optional automatic fallback to a free/local model, always with a visible notice.
- ✅ Approval dialog for calls above a threshold. Default $0.05.
- ✅ Cloud transcription is also metered and stops at the cap (falls back to local).
- ◻ Estimates use ~4 characters per token; replace with provider token counting for paid models.

## Error handling

✅ Microphone denied · no microphone · silence · too short · offline · provider outage · invalid key · rate limit · insufficient funds · model refusal · Ollama not running · hotkey already taken · paste unavailable.

## App Store (iOS, later) checklist

- ◻ `NSMicrophoneUsageDescription` and, if used, `NSSpeechRecognitionUsageDescription` with plain reasons.
- ◻ Privacy manifest (`PrivacyInfo.xcprivacy`) with required-reason APIs, including for third-party SDKs.
- ◻ App Privacy "nutrition label": audio and user content declared as *not collected* when processed on device; declared and linked to purpose when a cloud provider is used.
- ◻ Keyboard extension: works without Full Access for basic typing, explains clearly why Full Access is needed, never logs keystrokes (Guideline 4.4.1).
- ◻ Third-party AI disclosure and consent: name each provider and get permission before sending personal data (Guideline 5.1.2).
- ◻ Generative AI content: age rating questionnaire answered, way to report problematic output.
- ◻ Payments: BYO API keys only, or StoreKit for anything sold inside the app (Guideline 3.1.1). No links to external purchase unless entitled.
- ◻ Account deletion in-app if accounts are ever added (5.1.1(v)).
- ◻ Background audio mode justified by a visible recording indicator (Live Activity).
- ◻ Export compliance: only standard HTTPS/OS crypto (`ITSAppUsesNonExemptEncryption = NO`).
- ◻ Mac App Store variant: App Sandbox with microphone and network-client entitlements; pasting into other apps needs Accessibility permission, which is not allowed in the sandbox, so distribute the full version outside the Mac App Store.
