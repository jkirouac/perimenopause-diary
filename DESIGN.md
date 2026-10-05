# Design

How Ebb & Flow, our version of CeMCOR's Daily Perimenopause Diary, looks, sounds and behaves. The colours and design language follow **Harmoni** (by thePause): lavender to violet, gold accents, beige cards, a serif for headings, and a gentle voice. The rules below come from the September 2026 market scan's "Worth borrowing" and "Worth avoiding" lists. Scan: <https://claude.ai/artifact/2cKpX8VLTMXoVMpKfvN8bK>.

All colours live as tokens at the top of `src/styles.css`. After changing any token, run `node scripts/check-contrast.mjs`: it fails if any pairing below drops under its minimum.

## Principles

### Borrow

| Rule | Where | Status |
|---|---|---|
| Logging is open any time, more than once a day. Hot flushes don't wait for bedtime. | Tonight's "Hot flush just now? +1" card; Today/Yesterday | Built |
| Gentle voice. Never shame a gap or a skipped day. | All copy (see Voice) | Built |
| Symptoms use the 0–4 scale. It's quick, and it matches the Menopause Rating Scale clinicians use. | Every strength row | Built |
| Blank means "not recorded"; 0 means "none". They never look the same. | Tonight, Month grid, care team copy | Built |
| Light is the default on every phone (decided 2026-09-30). A calm dark mode, deep plum rather than black-and-white glare, is there for 3 a.m. if she wants it. | Settings → Appearance: Light, Dark, Match my phone | Built |
| A report she can edit before an appointment (from Balance). | Care team tab | Future: prints as-is today |
| Easy to put on the home screen. | Install banner on Tonight, card on sign-in and Settings. One tap on Android; two steps shown on iPhone | Built |
| One-tap logging from the home screen (from Clue's widget). | Phone home screen | Future |

### Avoid

| Rule | How we keep it |
|---|---|
| Nothing between her and the log. | Tonight opens straight onto the day. No articles, tips or cards above the rows except the flush counter. The one exception is the install banner: it appears only in a browser tab, "Not now" hides it for good, and it never appears inside the installed app. |
| No interruptions after saving. | Saving is silent and automatic. No pop-ups, ratings prompts or upsells, ever. |
| No long setup. | Sign-in is an email code; the standard rows are ready at once. |
| No huge list up front. | Rows she doesn't track can be hidden; medications can be retired. |
| Never save what she didn't tap. | Only "Mark the other N as none" fills rows for her, and only when she taps it, with the count shown on the button. |
| No busy calendars. | The Month grid shows values only, grouped with rules between sections. There are no badges or markers. |
| No wording that assumes her situation (for example, that she still has periods). | No predictions and no cycle days. Labels describe what she records, not what she should be experiencing. |

## Colour

The source Harmoni colours are lavender `#EED2FF`, violet `#9855D4`, deep purple `#562F72`, button purple `#734098`, text `#311A41`, gold `#FFC654`, beige `#F7F3EE` and pink italic `#C2408C`. The tokens below adapt these for legibility. Ratios are WCAG contrast, measured by `scripts/check-contrast.mjs`.

### Light

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--bg` | `#f8f7fb` | Page | |
| `--surface` | `#ffffff` | Row cards, tab bar | |
| `--surface-warm` | `#f7f3ee` | Warm beige card (Harmoni) | |
| `--ink` | `#311a41` | Text | 14.5 on bg |
| `--muted` | `#65566f` | Secondary text, legends | 6.3 on bg |
| `--line` | `#e6deef` | Borders and dividers | |
| `--accent` | `#734098` | Buttons, links, selected tab | 7.2 on surface |
| `--accent-ink` | `#ffffff` | Text on accent buttons | 7.2 on accent |
| `--accent-soft` | `#f1e6fa` | Selected backgrounds, icon tiles | accent on it 6.0 |
| `--emphasis` | `#b3337c` | The one pink italic word in a title | 4.2 on header-to, 5.4 on bg. Large headings only: it is under 4.5 on the header |
| `--gold` / `--gold-soft` / `--gold-ink` | `#ffc654` / `#fff3d1` / `#5e4100` | The flush card: gold border, cream fill | gold-ink on gold-soft 8.5 |
| `--danger` | `#a3303f` | Errors, delete | 6.9 on surface |
| `--header-from` → `--header-to` | `#f6ecff` → `#ead6fb` | Soft gradient behind the day | ink 11.5 |

`--radius` is `14px` for cards and panels.

### 0–4 strength

One hue, lavender to deep purple, getting steadily stronger:

| | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Light | `#f1eef5` | `#eed2ff` | `#dbb4fb` | `#c093ec` | `#734098`, white text |
| Dark | `#2a2233` | `#3d2b54` | `#56397a` | `#7a4fae` | `#cfa6f5`, dark text |

Text on 4 is `--sev-ink-strong` (`#ffffff` light, `#1b1222` dark). Dark 3 is the tightest pairing in the app (ink 4.85), so don't brighten it.

### Compared with usual (M–Z)

M is much less, L a little less, U usual, Y a little more and Z much more. This scale diverges: gold for less, violet for more, and a quiet neutral for usual. Neither direction means "bad".

| | M | L | U | Y | Z |
|---|---|---|---|---|---|
| Light | `#f6c75e` | `#ffe9b3` | `#f1eef5` | `#eed2ff` | `#c093ec` |
| Dark | `#7a5718` | `#4a3a1c` | `#2a2233` | `#3d2b54` | `#6a449c` |

### Dark mode

Light is the default everywhere, even on a phone set to dark. Dark applies only when chosen in Settings (or "Match my phone"); `index.html` sets `data-theme="dark"` before the page draws. Harmoni has no dark mode; this one is our own: deep plum rather than black, and text in soft lavender-white, never pure white. Every pairing passes the same checks as light mode.

| Token | Value | Contrast |
|---|---|---|
| `--bg` | `#17121d` | |
| `--surface` | `#211a29` | |
| `--surface-warm` | `#2a2230` | |
| `--ink` | `#eee6f4` | 15.1 on bg |
| `--muted` | `#b3a5c0` | 7.9 on bg |
| `--line` | `#372d42` | |
| `--accent` / `--accent-ink` | `#cfa6f5` / `#1b1222` | 8.4 on surface; ink on accent 9.0 |
| `--accent-soft` | `#35264a` | accent on it 6.8 |
| `--emphasis` | `#f2a0cb` | 7.6 on header-to |
| `--gold` / `--gold-soft` / `--gold-ink` | `#e7b451` / `#3a2f1a` / `#ffd98a` | gold-ink on gold-soft 9.7 |
| `--danger` | `#f09aa6` | 7.9 on surface |
| `--header-from` → `--header-to` | `#241a30` → `#2f2140` | ink 12.2 |

The phone's status-bar colour (`theme-color`) is set in `index.html` to copies of `--header-from`: `#f6ecff` light and `#241a30` dark. If you change the header gradient, change both places. The contrast script doesn't read `index.html`.

## Type

- **Headings:** Fraunces, a soft serif, at weight 600. Screen titles may put **one** word in pink italic (`.emph`), for example "How was *today*?". Never use more than one.
- **Body:** Figtree, weights 400, 500 and 600.
- Both fonts are bundled with `@fontsource` and cached for offline use. There is no request to a font service, so nobody else learns when she opens the app.

## Components

- **Day header:** a rounded panel with the soft lavender gradient. It holds the Today/Yesterday switch with the share icon at its right, the title ("How was *today*?"), the date and "N of M filled".
- **Flush card:** cream with a gold border and a purple "+1". Apart from the day header (and the install banner, in a browser tab), it is the only thing above the rows.
- **Sections:** the heading is serif, with a line icon in a pastel rounded square (`.tile`). The rows sit in one white card with hairline dividers and a very soft shadow.
- **Choices:** rounded squares. The selected one gets its colour from the ramp and a dark outline, so the choice doesn't rely on colour alone.
- **Row names never break mid-word.** Beside the 0–4 buttons, the buttons shrink (44 → 36 px) before a name has to wrap. With large text on a narrow phone (row under 21em), the name goes on its own line above full-width buttons. Names with a slash wrap after the slash.
- **Install banner:** a slim white card above the day header, "Add the diary to your home screen", with **Install** and **Not now**.
- **Sharing:** a quiet share icon (the phone's own: box and arrow on Apple devices, three joined circles elsewhere) at the top right of Tonight's day header, and a **Share Ebb & Flow** card in Settings. Both wait for her to tap: the app never prompts her to share. Either one opens the phone's share sheet (or copies the link) with the landing page URL, without referral codes. It shares the app, never diary data.
- **Medications:** name, then usual dose and notes in muted text. Once taken, a time field and a "Dose today, if different" field appear.
- **Tab bar:** line icons. The current tab gets a lavender pill behind its icon, plus bold purple text.

## Voice

Gentle and plain, like Harmoni's "No shaming if you skip."

- Say "Nothing recorded in this period yet", not "missed" or "incomplete".
- Say "Saved as you go", not "Don't forget to save!".
- Name what she records ("Breast soreness"), and don't judge it ("Bad day").
- Errors say what happened and what to do: "Couldn't save that change. Check your connection and try again."
- Never name just one profession. Say "care team", or list several with the nurse practitioner first: "your nurse practitioner, doctor, midwife or anyone who supports your care". She is an NP; NPs provide primary care in Canada.
- Keep the CeMCOR credit wherever the paper form's layout is used.

## Print

The copy for her care team prints in greys and black only, never purple. The numbers and letters carry the meaning, and colour only adds emphasis. It is landscape, one page per month, with a legend and the CeMCOR credit. The print colours are in the `@media print` block of `src/styles.css`: black text, and 0–4 from white through `#eeeeee`, `#d4d4d4` and `#aaaaaa` to `#555555` with white text. The contrast script doesn't check them.

## Landing page

What a signed-out visitor sees in a browser tab (`src/screens/Landing.tsx`). The installed app never shows it; it opens straight to sign-in. The audience is friends and her patients, who get the link directly, so the page carries `noindex` and explains rather than sells.

- **Name:** **Ebb & Flow**, always with "Based on CeMCOR's Daily Perimenopause Diary" close by. The printed copy keeps CeMCOR's own title.
- **Positioning:** a free, private, evening version of the paper diary clinicians already use. Say what Ebb & Flow does; never name or criticise other apps.
- **Every claim must be true of what's built.** Free, no predictions, 0–4 like the Menopause Rating Scale, hot flushes logged any time, blank ≠ none, a copy for the care team, stored in Canada, no ads or AI, works offline, download or delete at any time. If a feature changes, change the page.
- **Privacy wording:** "Your diary is stored in Canada, and only you can see it in the app. Nothing is sold or shared."
- **Not medical advice:** it's said in the questions and the footer, and in Settings.
- **Screenshots** come from `scripts/landing-shots.mjs`, which uses a throwaway account with invented entries and never a real diary. Re-run it when the screens change.
- **Look:** the same tokens and type as the app. A lavender hero with the Tonight screen in a phone frame, white cards, icon tiles from `SectionIcon`, and one pink italic word ("A calm *evening* check-in").
