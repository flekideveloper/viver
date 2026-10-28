# VIVER — Creator Workspace

A clean, local-first workspace for YouTubers, TikTok creators, Twitch streamers and X (Twitter) users.

**Website:** https://flekideveloper.github.io/viver/

## VIVER v0.1 alpha

- **Overview** — real counts for your locally saved plans, reminders and sticky notes.
- **Analytics** — transparent empty states; NO fake numbers. Shows exactly which metrics still require an authorized API connection.
- **Connections** — YouTube, TikTok, Twitch and X (Twitter) setup information and official developer documentation.
- **Content planner** — add, filter, change stages and remove scheduled content. Each entry has platform, date, stage and notes.
- **Reminders** — due date/time and priority, completion, filters and deletion. Optional browser notifications for reminders that become due *while VIVER is open*.
- **Idea board** — a real whiteboard with six sticky-note colors. Add, edit, drag by the top edge, duplicate, recolor, zoom and delete sticky notes. Double-click blank board area to add a note.
- **Settings** — midnight/daylight themes, English/partial Ukrainian interface, JSON backups, import and data reset.
- **Search** — Ctrl+K opens a search across all locally saved notes, reminders and content plans.
- Responsive interface for desktop, tablet and phone.

## Privacy and persistence

This release is static HTML, CSS and JavaScript hosted via GitHub Pages. Your plans, sticky notes, reminders and preferences are saved in the browser's \`localStorage\` and remain on **that device and browser only**. Data is not shared between your devices, not saved to GitHub, not synchronized with a server and not accessible to the website owner.

Export a JSON backup in **Settings** regularly to avoid losing content if browser storage is cleared. Importing a backup replaces the current local workspace.

Browser reminder notifications are **not push notifications**: they work only while VIVER is open, with permission and browser support. Missed reminders remain visible as overdue.

## API connections — not implemented yet

The four integrations are **displayed but explicitly marked "Not connected"**. The app does not implement social-media sign-in, OAuth, data sync or cross-platform analytics. No statistics are fabricated. These features require additional infrastructure:

| Platform | Requirements |
| --- | --- |
| YouTube | Google OAuth client, consent screen, YouTube Data/Analytics APIs and approved scopes |
| TikTok | TikTok developer app and any required approvals for permitted profile/video metrics |
| Twitch | Twitch developer app, OAuth and Helix endpoints within available permissions |
| X (Twitter) | X developer access tier, approved OAuth and permitted metric endpoints |

Never put OAuth client secrets or long-lived provider access tokens in this public repository or into client-side JavaScript. Future OAuth and API handling should use a separate secured server-side service (e.g., Cloudflare Worker), with secrets managed in its secret store. Avoid promising "full stats" for metrics an API does not expose.

VIVER does **not** use or create infrastructure, databases or accounts belonging to previous unrelated projects.

## Deployment

1. In the repository go to **Settings → Pages → Build and deployment**.
2. Select **GitHub Actions** as the source.
3. The workflow at \`.github/workflows/deploy.yml\` publishes every push to \`main\`.
4. After deployment, open https://flekideveloper.github.io/viver/ .

Static site; no npm install or build tool required. Open \`index.html\` locally to preview, though some browser functions work best under HTTPS.

## File layout

- \`index.html\` — complete app shell and pages
- \`style.css\` — responsive dark/light design and whiteboard
- \`app.js\` — functional interactive features and local persistence
- \`favicon.svg\` — branded VIVER tab icon
- \`.github/workflows/deploy.yml\` — GitHub Pages deployment

## Roadmap

Secure accounts (optional), server-side provider integrations, authorization and permitted analytics, synchronized workspace storage, push reminders (where supported), collaboration, and improved localization. All are future work, not shipped features.
