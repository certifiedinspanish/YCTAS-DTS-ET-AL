/* ============================================================
   game3.js — Cuatro Amigos (Vocabulary + DTS role-play)
   Rewritten against the new generated Answer Bank (game3_data_V1.json).
   Fixes carried over from the redesign:
     - No hand-typed content — everything driven by data.
     - Closes the Clifford naming gap (every character can be named
       in an Él/Ella sentence by every other speaker).
     - Drops the rejected "noun es Name" reversed pattern entirely.
     - "¡Dilo!" renamed to "Check" — it's a submit/verify button,
       not a speech-production feature (no mic exists anywhere here).

   NOT YET IMPLEMENTED IN THIS FILE (see stubs at the bottom):
     - Circling (needs its own build — see Triangling_Question_
       Selection_Spec_V1.md for the character-scoping rule that also
       matters here)
     - Triangling (same — character-blocked question pools, Leitner
       reuse from Plan 1)
   ============================================================ */

let GAME_DATA = null;
let currentCharacter = null;
let selectedWords = [];

async function loadGameData() {
  const res = await fetch("game3_data.json");
  GAME_DATA = await res.json();
  return GAME_DATA;
}

/* ------------------------------------------------------------
   VOCABULARY — tap-to-hear word bank (23 words)
   Every tap plays audio immediately. No text-only elements.
   ------------------------------------------------------------ */
function renderVocabulary(containerEl) {
  containerEl.innerHTML = "";
  GAME_DATA.vocabulary.forEach(entry => {
    const btn = document.createElement("button");
    btn.className = "vocab-word";
    btn.textContent = entry.word;
    btn.setAttribute("aria-label", entry.word);
    btn.onclick = () => playAudio(entry.audio);
    containerEl.appendChild(btn);
  });
}

/* ------------------------------------------------------------
   DTS ROLE-PLAY — character select -> build sentence from word
   bank -> Check -> validate against answerBank -> play confirm audio
   ------------------------------------------------------------ */
function selectCharacter(name) {
  currentCharacter = GAME_DATA.characters.find(c => c.name === name);
  selectedWords = [];
  renderCharacterWordBank();
  renderBuiltSentence();
}

function renderCharacterWordBank() {
  const bankEl = document.getElementById("word-bank");
  bankEl.innerHTML = "";
  // Shared word bank: every vocabulary word is tappable regardless of
  // active character. Grammar rules (yo/tú/él) are enforced at
  // check-time against the answerBank, not by restricting which
  // words can be tapped — matches the original tap-anything design.
  GAME_DATA.vocabulary.forEach(entry => {
    const btn = document.createElement("button");
    btn.className = "word-tile";
    btn.textContent = entry.word;
    btn.onclick = () => {
      playAudio(entry.audio);           // tap-to-hear, every time
      selectedWords.push(entry.word);
      renderBuiltSentence();
    };
    bankEl.appendChild(btn);
  });
}

function renderBuiltSentence() {
  document.getElementById("built-sentence").textContent = selectedWords.join(" ");
}

function clearSentence() {
  selectedWords = [];
  renderBuiltSentence();
}

/* "Check" button — was "¡Dilo!" in the old version. Not a speech
   production feature; submits the tapped sentence for validation. */
function checkSentence() {
  const attempt = selectedWords.join(" ").trim();
  const bank = GAME_DATA.answerBank[currentCharacter.name] || [];

  const match = bank.find(entry =>
    normalize(entry.sentence) === normalize(attempt)
  );

  if (match) {
    playAudio(match.audio);
    showFeedback(true, "¡Correcto!");
  } else {
    // Confirmed wording per project decision:
    showFeedback(false, "Not quite — check the story details");
  }
  clearSentence();
}

function normalize(s) {
  return s.toLowerCase().replace(/[¡!.,¿?]/g, "").trim();
}

function playAudio(filename) {
  const audio = new Audio(`audio/${filename}`);
  audio.play().catch(() => {
    // Silent fail-safe: if a clip isn't recorded yet (staging phase),
    // don't break the UI. Filenames are already final per the
    // recording spreadsheet, so this only fires for not-yet-recorded
    // content, not a broken reference.
    console.warn(`Audio not yet available: ${filename}`);
  });
}

function showFeedback(correct, message) {
  const el = document.getElementById("feedback");
  el.textContent = message;
  el.className = correct ? "feedback-correct" : "feedback-retry";
}

/* ------------------------------------------------------------
   CIRCLING — STUB. Not built yet.
   When built: question + confirm = Narrator voice, always. Answer =
   Male voice (never Paula's own voice — no personal representation
   in this activity, per Curious C's rule). Randomize/recycle freely,
   Leitner-box style, reusing Plan 1's engine.
   ------------------------------------------------------------ */
function initCircling() {
  console.warn("Circling not yet implemented — content exists in game3_data.json under a future 'circling' key, engine not built.");
}

/* ------------------------------------------------------------
   TRIANGLING — STUB. Not built yet.
   When built: MUST track two states — activeCharacter AND each
   item's Leitner box position. Randomization pool scoped to ONE
   character's tú-block at a time (see Triangling_Question_
   Selection_Spec_V1.md — tú-questions are not self-disambiguating
   by text alone, e.g. "¿Eres alta?" has different correct answers
   depending on who's active). Third-person (él/ella) questions ARE
   self-disambiguating and may be pooled freely across characters.
   ------------------------------------------------------------ */
function initTriangling() {
  console.warn("Triangling not yet implemented — requires activeCharacter + Leitner state tracked together. See spec doc before building.");
}
