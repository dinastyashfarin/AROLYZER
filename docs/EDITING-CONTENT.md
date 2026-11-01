# Editing the website text

Every word on the site lives in the `content/` folder as plain JSON files. You don't need to touch any code to change copy, prices, specs, partner logos or translations.

```
content/
  site.json            price, calculator numbers, partner logos, page titles, company name/address
  en/landing.json      landing page, English
  id/landing.json      landing page, Bahasa Indonesia
  en/waitlist.json     waitlist form, English
  id/waitlist.json     waitlist form, Bahasa Indonesia
  en/email.json        confirmation email, email footer, confirm/unsubscribe pages, English
  id/email.json        the same in Bahasa Indonesia
```

## Change some text

1. Open the English file and find the sentence (search for a few words of it).
2. Change the text on the right of the colon. Leave the name on the left (the "key") as it is.
3. Make the same change in the Indonesian file, under the same key.
4. Run `npm run check:content` to catch mistakes, then publish (see below).

```json
"pricing": {
  "one_unit_ready_from_day": "One unit, ready from day one.",
```

The keys were named after the first words of the original text. If you rewrite the sentence, the key can stay the same; it's only a label.

## Rules for the text

- **Quotes and commas.** Every value sits inside straight double quotes `"…"` and every line except the last in a block ends with a comma. To show a double quote inside the text, use curly quotes `“ ”` or `\"`.
- **Placeholders** in curly braces, like `{capacity}` or `{name}`, are filled in by the page. Keep them in both languages; you can move them within the sentence.
- **Formatting.** Some values contain `<b>bold</b>`, `<strong>`, `<em>`, `<br>` or `<a href="#price">a link</a>`. These are the only tags allowed; anything else shows as plain text. Keep the same tags in English and Indonesian.
- **Missing Indonesian** falls back to English, so the page never breaks. `npm run check:content` lists anything that's still untranslated.
- **Lists must match.** `steps` (How it works) needs exactly 8 items and `upclose.parts` exactly 6, because each one is tied to a 3D camera move. Indonesian lists need the same number of items as English.

## Common changes

| What | Where |
| --- | --- |
| Hero headline (two lines), intro, button | `hero.title`, `hero.lede`, `hero.cta` in `landing.json` |
| Price | `price` in `site.json` |
| Calculator assumptions (reactor volume, bulk density, yield, hours per batch) | `calculator` in `site.json` (numbers, no quotes) |
| The eight How it works steps | `steps` in `landing.json` (title, body, tags) |
| Up close parts | `upclose.parts` in `landing.json` |
| Part names shown when hovering the 3D model | `part_names` in `landing.json` |
| Partner logos | `logos` in `site.json`. Put the image in `public/assets/logos/` and add `{ "src": "/assets/logos/name.png", "alt": "Company name" }` |
| Browser tab title and search description | `title`, `waitlistTitle`, `description` in `site.json` |
| Waitlist form choices (roles, operations, tonnage) | `choices` in `waitlist.json` |
| Confirmation email and unsubscribe pages | `email.json` |
| Company name and postal address in email footers | `company` in `site.json` (adding an address is recommended for bulk email) |

`phrases` and `patterns` at the bottom of the Indonesian files translate text the page builds while it runs (tooltips, step counters, labels). Edit the Indonesian side if a word is wrong; leave the English side alone.

## See and publish your changes

- **While editing:** `npm run dev` and open http://localhost:5173. The page updates as you save.
- **Publish:** run `npm run build`, then restart the server (or `docker compose up -d --build`). Page text is built into the site, so it needs the rebuild. Email text is read live, so email changes apply straight away.

## Changes that do need code

- New sections or a different layout: `src/landing/Landing.jsx` and `src/landing/landing.css`.
- Adding or removing a How it works step or an Up close part: the camera moves are in `src/landing/data.js`.
- A third language: add `content/<lang>/` files and register them in `src/content.jsx`.
