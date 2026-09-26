# Benny's

A cocktail quick-reference for the phone: big, glanceable ingredient amounts with one-tap batch math.

- **Use it:** open https://bgterdich.github.io/bennys/ in Safari on iPhone → Share → **Add to Home Screen**.
- **Add or edit cocktails:** edit `recipes.json` and push to `main`. The site updates within a minute or two; the app picks up changes next time it opens. No app update needed.

## `recipes.json`

```json
{
  "folders": [{ "id": "rum", "name": "Rum" }],
  "cocktails": [
    {
      "id": "daiquiri",                 // unique, kebab-case; used in the URL
      "name": "Daiquiri",
      "favorite": true,                 // shows on the home screen
      "folders": ["rum"],               // folder ids; a cocktail can be in several
      "color": "#E3D9AE",               // small dot on tiles; roughly the drink's color
      "ingredients": [
        { "name": "White rum", "amount": 2, "unit": "oz" },
        { "name": "Angostura bitters", "amount": 2, "unit": "dash" },
        { "name": "Egg white", "amount": 1 },
        { "name": "Soda water", "amount": "top" }
      ],
      "glass": "Coupe",
      "garnish": "Lime wheel",
      "special": "Dry shake (no ice) first",  // only when there's a non-obvious step
      "notes": "Ideally Brand X soda"         // only when Ben asks for a note
    }
  ]
}
```

- `amount` is a number in the given `unit` (decimals are fine: `0.75`); it's shown as a stacked fraction when it's a half, third, quarter or eighth, and multiplied for batches. Units that pluralize: `dash`, `drop`, `barspoon`, `leaf`, `sprig`, `slice`, `wedge`, `cube`, `piece`. Omit `unit` for counts.
- A text `amount` (e.g. `"top"`, `"to taste"`) is shown as-is and not multiplied.
- `glass`, `garnish`, `special`, `notes` are optional and shown below the fold. Keep them pithy.
- Folders with no cocktails are hidden.
- Tapping the star in the app overrides `favorite` on that phone only.

## Files

`index.html`, `app.css`, `app.js` (the app, no build step) · `sparkle.js` (tap the title for a burst of color) · `sw.js` (offline support) · `manifest.webmanifest`, `icons/` (home-screen app) · `fonts/` (Bai Jamjuree, OFL).
