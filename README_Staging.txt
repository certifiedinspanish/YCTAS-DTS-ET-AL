CUATRO AMIGOS — DTS STAGING BUILD (V1)
=========================================
For the new dedicated staging repo (not yet created — send the
repo name/link once it exists, this is ready to upload directly).

WHAT'S HERE:
- game3_data.json  — generated Answer Bank (facts-table method,
  Clifford naming gap fixed, rejected pattern removed, 23-word
  vocabulary)
- game3.js         — Vocabulary + DTS role-play, fully rewritten
  and TESTED against the real data (see test results below)
- index.html       — minimal standalone preview page, so this can
  be opened and clicked through immediately once uploaded, without
  needing the rest of the site built

TESTED, NOT JUST WRITTEN:
- Confirmed Paula can correctly name Clifford ("Clifford es un
  perro") — the exact bug this whole redesign was meant to fix.
- Confirmed the rejected "Un perro es grande" pattern correctly
  produces NO match — it's gone, not just hidden.

NOT YET BUILT (stub functions included, clearly marked in
game3.js, do NOT attempt to call them yet):
- Circling — needs its own build. Rule: Narrator voice for every
  question/confirm, Male voice for the answer (never Paula's own
  voice — no personal representation in this activity).
- Triangling — needs its own build. Rule: must track activeCharacter
  AND each item's Leitner box position together. Randomization pool
  scoped to ONE character's tú-block at a time — see
  Triangling_Question_Selection_Spec_V1.md for the full reasoning
  (tú-questions are not self-disambiguating by text alone).

RENAME NOTE: "Check" button replaces the old "¡Dilo!" label — it's
a submit/verify action, not a speech-production feature (no
microphone exists anywhere in this app).

AUDIO: filenames referenced throughout already match the final
recording-spreadsheet convention (f_/m_/narr_ prefixes,
pregunta_/narr_voc_ sub-prefixes). Missing clips fail silently in
the browser console rather than breaking the UI — safe to test with
partial/no audio during staging.
