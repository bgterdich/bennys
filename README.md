# Benny's

A cocktail quick-reference for the phone: big, glanceable ingredient amounts with one-tap batch math.

- **Use it:** open https://bgterdich.github.io/bennys/ in Safari on iPhone → Share → **Add to Home Screen**.
- **Add or edit cocktails:** edit `recipes.json` and push to `main`. The site updates within a minute or two; the app picks up changes next time it opens. No app update needed.

## `recipes.json`

```json
{
  "favorites": ["daiquiri"],             // home-screen favorites, in display order (cocktail ids)
  "folders": [{ "id": "rum", "name": "Rum" }],
  "cocktails": [
    {
      "id": "daiquiri",                 // unique, kebab-case; used in the URL
      "name": "Daiquiri",
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
- `glass`, `garnish`, `special`, `notes` are optional and shown below the fold. Keep them pithy. A bare `https://` URL in any of them shows as a link labeled with its site name.
- Folders with no cocktails are hidden.
- Tapping the star in the app overrides `favorites` on that phone only; phone-only favorites show after the listed ones.

## Party planner

**Plan party** (bottom of the home screen) opens Parties: your saved parties (with progress) to pick up, or start a new one by name. In a party: pick cocktails (from the library, or new ones typed in, which stay with that party), optionally say how many of each, tick ingredients on hand, then a shopping list to tick off or copy. Same ingredient names are combined across cocktails; totals show once each cocktail using an ingredient has a count; lime, lemon and grapefruit juice also show how many fruit to buy, as a range from juicy/large to dry/small fruit. Drinks are picked like the home screen: favorites at the top, folders to tap into (favorites also appear in their folders), and search across everything. The Shop tab has a **Conversions** sheet (juice per fruit, bottle sizes in oz, small measures).

Juice per fruit, in `FRUIT` in `app.js` (oz, dry/small to juicy/large):
- Lime ¾–1¼: about 0.8–1.25 from 8–10 tbsp per lb at 4–5 limes per lb (https://www.webstaurantstore.com/blog/2760/juice-in-citrus-fruits.html); 1–1⅓ for medium limes, 6–8 per cup (https://foodservice.sunkist.com/?p=1407).
- Lemon 1–2: small ~1 to 1.5, large ~2.5 (https://chowhound.com/1675252/how-many-ounces-juice-one-lemon); very small 1, medium 1½, large 2 (https://www.acouplecooks.com/how-much-juice-in-one-lemon); ~1⅓ medium (Sunkist).
- Grapefruit 5–8: ~5⅓ medium (Sunkist); 6 standard (WebstaurantStore); 8 (https://www.amazingfoodmadeeasy.com/produce_converters/grapefruit).

Parties are saved on that phone only (`localStorage` key `bennys.parties`), not in `recipes.json`.

## Files

`index.html`, `app.css`, `app.js` (the app, no build step) · `sparkle.js` (tap the title for a burst of color) · `sw.js` (offline support) · `manifest.webmanifest`, `icons/` (home-screen app) · `fonts/` (Bai Jamjuree, OFL).
