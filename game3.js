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
    btn.onclick = () => {
      flashTap(btn);           // visible feedback on EVERY tap, audio or not
      playAudio(entry.audio);
    };
    containerEl.appendChild(btn);
  });
}

/* Brief visible press effect so every tap confirms itself, independent
   of whether audio exists yet — fixes the "looks dead" issue found
   during staging testing (audio being unrecorded was never the real
   cause; there was simply no visual response at all). */
function flashTap(el) {
  el.classList.add("tapped");
  setTimeout(() => el.classList.remove("tapped"), 180);
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
  // FIXED: only show vocabulary words that actually appear somewhere
  // in DTS's answerBank content. The full 23-word Vocabulary list
  // includes Sí/No/y/o/Quién/"Cómo es" -- built for Circling and
  // Triangling only, never usable in any valid DTS sentence. Showing
  // them here was misleading clutter.
  const dtsWords = dtsUsableVocabulary();
  dtsWords.forEach(entry => {
    const btn = document.createElement("button");
    btn.className = "word-tile";
    btn.textContent = entry.word;
    btn.onclick = () => {
      flashTap(btn);
      // MUTED on purpose: individual word taps inside DTS's sentence
      // builder used to play the word's own Narrator audio -- with
      // several taps per sentence, this drowned out the one moment
      // that actually matters: the character's own voice confirming
      // a correct full sentence on Check. Text still builds visibly;
      // only Check triggers audio now.
      selectedWords.push(entry.word);
      renderBuiltSentence();
    };
    bankEl.appendChild(btn);
  });
}

function renderBuiltSentence() {
  document.getElementById("built-sentence").textContent = selectedWords.join(" ");
}

let _dtsUsableVocabCache = null;
function dtsUsableVocabulary() {
  if (_dtsUsableVocabCache) return _dtsUsableVocabCache;
  const allSentences = [];
  Object.values(GAME_DATA.answerBank).forEach(entries =>
    entries.forEach(e => allSentences.push(e.sentence))
  );
  const allText = allSentences.join(" ").toLowerCase().replace(/[¡!.,¿?]/g, "");
  const tokens = new Set(allText.split(/\s+/));
  _dtsUsableVocabCache = GAME_DATA.vocabulary.filter(v => {
    const vWords = v.word.toLowerCase().split(/\s+/);
    return vWords.every(w => tokens.has(w));
  });
  return _dtsUsableVocabCache;
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
  } else if (describesSelfInThirdPerson(attempt)) {
    // e.g. Clifford tapping "Clifford es grande" -- grammatically
    // valid Spanish, and genuinely correct content elsewhere in the
    // system (another speaker describing him), but a character
    // never describes THEMSELVES in third person -- they use "Soy".
    // Checked BEFORE the Harry-specific checks below, since if Harry
    // himself is active and taps "Harry es..." about himself, "Try
    // Soy" is the right message -- not "talk to Harry" or "try eres
    // for Harry", which would both be nonsensical self-addressed.
    showFeedback(false, `Try "Soy..." when talking about yourself!`);
  } else if (usesEresOnNonHarry(attempt) || usesEsOnHarry(attempt)) {
    // Both violations are the SAME underlying rule, just from opposite
    // directions: only Harry is ever addressed directly. One unified
    // message avoids ever echoing back the specific wrong word(s) the
    // learner tapped (e.g. "rico", "Lez") -- learners absorb whole
    // feedback phrases as chunks well before they parse them word by
    // word, so a message that repeats wrong content risks that wrong
    // content getting bonded to the phrase itself. This message states
    // only the general rule, nothing from the specific attempt.
    showFeedback(false, "Only Harry is ever addressed directly (with \"eres\")!");
  } else {
    showFeedback(false, "Not quite — check the story details");
  }
  clearSentence();
}

function usesEresOnNonHarry(attempt) {
  const words = normalize(attempt).split(/\s+/);
  if (!words.includes("eres")) return false;
  const otherNames = ["paula", "lez", "clifford"];
  return otherNames.some(name => words.includes(name)) && !words.includes("harry");
}

function usesEsOnHarry(attempt) {
  const words = normalize(attempt).split(/\s+/);
  return words.includes("es") && words.includes("harry");
}

function describesSelfInThirdPerson(attempt) {
  const words = normalize(attempt).split(/\s+/);
  const ownName = currentCharacter.name.toLowerCase();
  return words.includes("es") && words.includes(ownName);
}

function normalize(s) {
  return s.toLowerCase().replace(/[¡!.,¿?]/g, "").trim();
}

function playAudio(filename) {
  // Files live in the repo root, not an "audio/" subfolder --
  // matches how the mp3s actually got uploaded to the staging repo.
  const audio = new Audio(filename);
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

/* ============================================================
   CIRCLING — built against the REAL Leitner engine from Plan 1
   (verified directly against the live plan1.yctas.com source,
   not reinvented): 5 boxes, BOX_GAP = {1:2, 2:4, 3:6, 4:8},
   item-count-based due scheduling, wrong answer resets to box 1.

   Voice rule: question + confirm = Narrator (always). Answer =
   Male voice, EXCEPT bare Sí/No which reuse the Vocabulary
   recording (no duplicate clip needed).

   Mastery gate wording (finalized in design spec):
     - "Need a peek?" hint available once "enough" mastery reached
       (defined here as 80% at box 3+), before the full ALL-mastered
       gate. Hint does NOT advance the box (seeing ≠ producing).
     - Full unlock requires ALL items at box 3+.
   ============================================================ */

const CIRCLING_BOX_GAP = { 1: 2, 2: 4, 3: 6, 4: 8 };
let circlingItems = [];
let circlingItemCounter = 0;
let currentCirclingItem = null;

function initCircling() {
  circlingItems = GAME_DATA.circling.map(item => ({
    ...item,
    currentBox: 0,
    status: "new",      // 'new' | 'learning' | 'mastered'
    dueAtCount: null,
  }));
  circlingItemCounter = 0;
  renderNextCirclingItem();
}

function circlingDueItems() {
  return circlingItems.filter(it => it.status === "learning" && it.dueAtCount <= circlingItemCounter);
}

function circlingNewItems() {
  return circlingItems.filter(it => it.status === "new");
}

function pickNextCirclingItem() {
  const due = circlingDueItems();
  if (due.length > 0) {
    return due[Math.floor(Math.random() * due.length)];
  }
  const fresh = circlingNewItems();
  if (fresh.length > 0) {
    return fresh[Math.floor(Math.random() * fresh.length)];
  }
  return null; // nothing due, nothing new -- fully scheduled ahead
}

function renderNextCirclingItem() {
  const item = pickNextCirclingItem();
  currentCirclingItem = item;
  const container = document.getElementById("circling-container");
  if (!container) return;

  if (!item) {
    container.innerHTML = `<p>All caught up for now — check back soon.</p>`;
    return;
  }

  playAudio(item.questionAudio); // Narrator asks automatically
  container.innerHTML = `
    <div id="circling-question">${item.question}</div>
    <div id="circling-answer-input"></div>
    <div id="circling-hint-area"></div>
  `;
  renderCirclingAnswerInput(item);
  maybeShowHint();
}

function renderCirclingAnswerInput(item) {
  const el = document.getElementById("circling-answer-input");
  el.innerHTML = "";
  const btn = document.createElement("button");
  btn.className = "circling-answer-btn";
  btn.textContent = item.answer;
  btn.onclick = () => {
    flashTap(btn);
    const isBareYesNo = item.answer === "Sí" || item.answer === "No";
    playAudio(isBareYesNo ? item.answerAudio : item.answerAudio);
    submitCirclingAnswer(true); // tapping the shown correct-form answer;
                                  // full free-text/multi-choice entry is a
                                  // later build step, this proves the
                                  // Leitner scheduling loop end to end
  };
  el.appendChild(btn);
}

function submitCirclingAnswer(correct) {
  const item = currentCirclingItem;
  circlingItemCounter += 1;

  if (item.status === "new") item.status = "learning";

  if (correct) {
    if (item.currentBox === 5) {
      item.status = "mastered";
      item.dueAtCount = null;
    } else {
      item.currentBox += 1;
      item.dueAtCount = circlingItemCounter + CIRCLING_BOX_GAP[item.currentBox];
    }
  } else {
    item.currentBox = 1;
    item.dueAtCount = circlingItemCounter + CIRCLING_BOX_GAP[1];
  }

  // Narrator ALWAYS confirms in a full sentence, correct or incorrect
  playAudio(item.confirmAudio);
  showCirclingConfirm(item.confirm);

  updateCirclingGateProgress();
  setTimeout(renderNextCirclingItem, 1200);
}

function showCirclingConfirm(text) {
  const el = document.getElementById("circling-hint-area");
  if (el) el.textContent = text;
}

/* ---- Mastery gate: "enough" hint threshold + full ALL-mastered gate ---- */
function circlingMasteryStats() {
  const total = circlingItems.length;
  const atBox3Plus = circlingItems.filter(it => it.currentBox >= 3).length;
  return { total, atBox3Plus, allMastered: atBox3Plus === total };
}

function maybeShowHint() {
  const { total, atBox3Plus, allMastered } = circlingMasteryStats();
  const enoughThreshold = Math.ceil(total * 0.8);
  const hintArea = document.getElementById("circling-hint-area");
  if (!hintArea || allMastered) return;
  if (atBox3Plus >= enoughThreshold) {
    const hintBtn = document.createElement("button");
    hintBtn.textContent = "Need a peek?";
    hintBtn.className = "hint-btn";
    hintBtn.onclick = () => {
      // Reveals the answer WITHOUT advancing the box -- seeing an
      // answer isn't the same as producing it correctly.
      hintArea.textContent = currentCirclingItem.confirm;
    };
    hintArea.appendChild(hintBtn);
  }
}

function updateCirclingGateProgress() {
  const { total, atBox3Plus, allMastered } = circlingMasteryStats();
  const gateEl = document.getElementById("circling-gate-progress");
  if (!gateEl) return;
  gateEl.textContent = allMastered
    ? "Complete — Triangling unlocked!"
    : `${atBox3Plus} of ${total} mastered — Triangling unlocks once you've got them all!`;
}

/* ============================================================
   TRIANGLING — tú-block (direct address). Character-blocked per
   Triangling_Question_Selection_Spec_V1.md: questions stay scoped
   to ONE character at a time, never mixed, since "¿Eres alta?" is
   not self-disambiguating by text alone.

   Answer flow, per Curious C's design:
     1. Narrator's question auto-plays (real audio, already exists)
     2. Character's own word bank appears -- tapping a word is
        SILENT for now (no per-word audio recorded yet in each
        character's own voice; tiles are visual-only placeholders,
        NOT reusing the shared Vocabulary/Narrator audio, per the
        "mute vocab buttons outside Vocabulary" rule)
     3. Once the full answer is built, the character's own COMPLETE
        phrase plays (real audio, already recorded)
     4. Narrator confirms (real audio, already recorded)
     5. Auto-advances to the next question in the SAME character's
        block

   NOT YET BUILT: the Narrator-self ("yo") block and the él/ella
   third-person cross-reference block. This engine currently covers
   only the tú (direct-address) block, which is what was demoed.
   ============================================================ */

let trianglingActiveCharacter = null;
let trianglingQueue = [];
let trianglingIndex = 0;
let trianglingSelectedWords = [];

function selectTrianglingCharacter(name) {
  trianglingActiveCharacter = name;
  trianglingQueue = GAME_DATA.triangling.filter(e => e.character === name);
  trianglingIndex = 0;
  trianglingSelectedWords = [];
  renderTrianglingQuestion();
}

function renderTrianglingQuestion() {
  const container = document.getElementById("triangling-container");
  if (!container) return;

  if (trianglingIndex >= trianglingQueue.length) {
    container.innerHTML = `<p>${trianglingActiveCharacter}'s questions complete! Select a character to continue.</p>`;
    return;
  }

  const item = trianglingQueue[trianglingIndex];
  trianglingSelectedWords = [];
  playAudio(item.questionAudio); // Narrator auto-asks

  container.innerHTML = `
    <div id="triangling-active-char">Talking to: ${trianglingActiveCharacter}</div>
    <div id="triangling-question">${item.question}</div>
    <div id="triangling-word-bank"></div>
    <div id="triangling-built"></div>
    <div id="triangling-feedback"></div>
  `;
  renderTrianglingWordBank(item);
}

function renderTrianglingWordBank(item) {
  const bankEl = document.getElementById("triangling-word-bank");
  bankEl.innerHTML = "";
  item.answerWords.forEach(word => {
    const btn = document.createElement("button");
    btn.className = "word-tile";
    btn.textContent = word;
    btn.onclick = () => {
      flashTap(btn);
      // SILENT on purpose -- no per-word audio in the character's own
      // voice exists yet. Visual-only until those recordings are made.
      trianglingSelectedWords.push(word);
      document.getElementById("triangling-built").textContent = trianglingSelectedWords.join(" ");
      if (trianglingSelectedWords.length === item.answerWords.length) {
        submitTrianglingAnswer(item);
      }
    };
    bankEl.appendChild(btn);
  });
}

function submitTrianglingAnswer(item) {
  // Full natural phrase, in the character's OWN voice -- real audio.
  playAudio(item.answerAudio);
  setTimeout(() => {
    // Narrator confirms -- real audio.
    playAudio(item.confirmAudio);
    document.getElementById("triangling-feedback").textContent = item.confirm;
    trianglingIndex += 1;
    setTimeout(renderTrianglingQuestion, 1500);
  }, 1200);
}
