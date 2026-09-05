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

/* ============================================================
   4-PHASE SEQUENTIAL GATE: Vocabulary -> Circling -> Triangling ->
   DTS. Each phase locked until the previous is mastered. Per
   handover design (confirmed, not new): "master the meanings of
   words" (Vocabulary) -> "basic comprehension... one word"
   (Circling) -> "comprehension... complete sentences" (Triangling)
   -> DTS.
   ============================================================ */
let vocabHeardWords = new Set();
let trianglingTuCompleted = new Set();
let trianglingElEllaCompleted = new Set();

function vocabMastered() {
  // FIXED: "heard once" was never real mastery. Now reuses the same
  // Leitner engine already proven for Circling -- all 23 words must
  // reach box 3+ through actual correct recall, matching Plan 1's own
  // precedent (Learn -> Match Game -> Mastery Test -> Certificate).
  return vocabQuizItems.length > 0 && vocabQuizItems.every(it => it.currentBox >= 3);
}

function trianglingMastered() {
  const tuTotal = GAME_DATA.triangling.length;
  const elEllaTotal = GAME_DATA.trianglingElElla.length;
  return trianglingTuCompleted.size >= tuTotal && trianglingElEllaCompleted.size >= elEllaTotal;
}

function setCirclingLocked(locked) {
  const btn = document.getElementById("start-circling-btn");
  if (btn) btn.disabled = locked;
  const msg = document.getElementById("circling-lock-message");
  if (msg) msg.style.display = locked ? "block" : "none";
}

function setDtsLocked(locked) {
  const buttons = document.querySelectorAll("#char-select button");
  buttons.forEach(btn => {
    btn.disabled = locked;
    btn.classList.toggle("locked", locked);
  });
  const msg = document.getElementById("dts-lock-message");
  if (msg) msg.style.display = locked ? "block" : "none";
}

function checkGateProgression() {
  setCirclingLocked(!vocabMastered());
  // Triangling's own lock (setTrianglingLocked) already checks Circling
  // mastery separately -- this just also confirms Vocabulary is done
  // first, since the chain is sequential, not just pairwise.
  setDtsLocked(!trianglingMastered());
}


function renderVocabulary(containerEl) {
  containerEl.innerHTML = "";
  GAME_DATA.vocabulary.forEach(entry => {
    const btn = document.createElement("button");
    btn.className = "vocab-word";
    btn.textContent = entry.word;
    btn.setAttribute("aria-label", entry.word);
    btn.onclick = () => {
      flashTap(btn);
      playAudio(entry.audio);
      vocabHeardWords.add(entry.word);
      checkGateProgression();
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

function extractCoreAnswer(answer) {
  // Harry's Circling self-answers are formatted "Tú (Harry)" -- extract
  // just "Harry" so it matches the plain character-name option button.
  const match = answer.match(/^Tú \((.+)\)$/);
  return match ? match[1] : answer;
}

function playAudio(filename, onDone) {
  // Files live in the repo root, not an "audio/" subfolder --
  // matches how the mp3s actually got uploaded to the staging repo.
  const audio = new Audio(filename);
  // Real completion callback -- fixes the audio-overlap bug where a
  // fixed setTimeout guessed how long a clip would take, and the next
  // clip started playing before the real one actually finished.
  if (onDone) {
    audio.addEventListener("ended", onDone);
  }
  audio.play().catch(() => {
    // Silent fail-safe: if a clip isn't recorded yet (staging phase),
    // don't break the UI. Filenames are already final per the
    // recording spreadsheet, so this only fires for not-yet-recorded
    // content, not a broken reference.
    console.warn(`Audio not yet available: ${filename}`);
    if (onDone) onDone(); // don't let a missing clip stall the sequence
  });
}

function showFeedback(correct, message) {
  const el = document.getElementById("feedback");
  el.textContent = message;
  el.className = correct ? "feedback-correct" : "feedback-retry";
}

/* CIRCLING and TRIANGLING engines are built below (real Leitner
   scheduling, character-blocking, etc.) — this section previously
   held placeholder stubs, removed now that both are implemented. */

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

function startCircling() {
  document.getElementById("start-circling-btn").style.display = "none";
  initCircling();
}
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

  let options;
  if (item.type.startsWith("eitheror")) {
    // The question itself contains both real options: "¿X es A o B?"
    const match = item.question.match(/¿.*es (.+) o (.+)\?/i) || item.question.match(/¿.*(Soy|Eres) (.+) o (.+)\?/i);
    if (match) {
      options = [match[match.length-2], match[match.length-1].replace(/[¿?]/g,'')];
    } else {
      options = [item.answer];
    }
  } else if (item.type.startsWith("yesno") || item.type.startsWith("no")) {
    // Genuine binary choice -- Sí vs No, not just the correct one shown alone
    options = ["Sí", "No"];
  } else if (item.type === "quien-soy") {
    // Special case: "¿Quién soy yo?" -- the answer is a NOUN ("un
    // elefante"), not a character name. Character data has no
    // "article" field, and there are only 4 fixed nouns in this whole
    // game, so a small direct lookup is the most reliable approach.
    const NOUN_ARTICLES = { "chica": "una", "chico": "un", "perro": "un", "elefante": "un" };
    options = GAME_DATA.characters.map(c => {
      const noun = c.trait_words[0];
      return `${NOUN_ARTICLES[noun]} ${noun}`;
    });
  } else if (item.type.startsWith("quien")) {
    options = GAME_DATA.characters.map(c => c.name);
  } else {
    options = [item.answer];
  }

  // Shuffle so the correct answer isn't always in the same position
  options = [...options].sort(() => Math.random() - 0.5);

  options.forEach(optionText => {
    const btn = document.createElement("button");
    btn.className = "circling-answer-btn";
    btn.textContent = optionText;
    btn.onclick = () => {
      flashTap(btn);
      const isCorrect = normalize(optionText) === normalize(extractCoreAnswer(item.answer));
      if (isCorrect) {
        // FIXED: previously played the answer clip then immediately
        // (synchronously) called submitCirclingAnswer, which itself
        // immediately played the confirm clip -- same overlap bug.
        // Now waits for the answer clip to actually finish first.
        playAudio(item.answerAudio, () => submitCirclingAnswer(isCorrect));
      } else {
        submitCirclingAnswer(isCorrect);
      }
    };
    el.appendChild(btn);
  });
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

  // Narrator ALWAYS confirms in a full sentence, correct or incorrect.
  // FIXED: previously used a fixed 1200ms setTimeout guess before
  // advancing, which was shorter than many real confirm clips --
  // causing the next question's audio to start while the confirmation
  // was still playing (the overlapping-voices bug). Now waits for the
  // actual clip to finish via the real 'ended' event, plus a short
  // pause so the confirmation doesn't feel abrupt.
  showCirclingConfirm(item.confirm);
  updateCirclingGateProgress();
  playAudio(item.confirmAudio, () => {
    setTimeout(renderNextCirclingItem, 500);
  });
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
  if (gateEl) {
    gateEl.textContent = allMastered
      ? "Complete — Triangling unlocked!"
      : `${atBox3Plus} of ${total} mastered — Triangling unlocks once you've got them all!`;
  }
  setTrianglingLocked(!allMastered);
}

function setTrianglingLocked(locked) {
  const buttons = document.querySelectorAll("#triangling-char-select button");
  buttons.forEach(btn => {
    btn.disabled = locked;
    btn.classList.toggle("locked", locked);
  });
  const elellaBtn = document.getElementById("start-elella-btn");
  if (elellaBtn) elellaBtn.disabled = locked;
  const lockMsg = document.getElementById("triangling-lock-message");
  if (lockMsg) {
    lockMsg.style.display = locked ? "block" : "none";
  }
  // NOTE: the second lock message (elella-lock-message) is intentionally
  // left hidden always -- one message covers the whole Triangling
  // section now that it's unified under a single heading, avoiding a
  // duplicate "Complete Circling first" showing twice.
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

function characterImg(name) {
  const c = GAME_DATA.characters.find(c => c.name === name);
  return c ? c.img : "";
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
    <div id="triangling-active-char"><img src="${characterImg(trianglingActiveCharacter)}" alt="${trianglingActiveCharacter}"> Talking to: ${trianglingActiveCharacter}</div>
    <div id="triangling-question">${item.question}</div>
    <div id="triangling-word-bank"></div>
    <div id="triangling-built"></div>
    <div class="actions">
      <button id="triangling-check-btn" onclick="checkTrianglingAnswer()">Check</button>
      <button id="triangling-clear-btn" onclick="clearTrianglingAnswer()">Clear</button>
    </div>
    <div id="triangling-feedback"></div>
  `;
  renderTrianglingWordBank(item);
}

function renderTrianglingWordBank(item) {
  // FIXED: previously showed ONLY the exact correct words in isolation
  // -- no real choice, just the answer pre-assembled. Now reuses the
  // actual DTS pattern: the full relevant vocabulary bank, so there
  // are genuine distractors to choose between, same as DTS always had.
  const bankEl = document.getElementById("triangling-word-bank");
  bankEl.innerHTML = "";
  const wordPool = dtsUsableVocabulary().concat(
    GAME_DATA.vocabulary.filter(v => ["Sí", "No"].includes(v.word))
  );
  wordPool.forEach(entry => {
    const btn = document.createElement("button");
    btn.className = "word-tile";
    btn.textContent = entry.word;
    btn.onclick = () => {
      flashTap(btn);
      // Still SILENT on purpose -- no per-word audio in the character's
      // own voice exists yet, per Curious C's confirmed design.
      trianglingSelectedWords.push(entry.word);
      document.getElementById("triangling-built").textContent = trianglingSelectedWords.join(" ");
    };
    bankEl.appendChild(btn);
  });
}

function clearTrianglingAnswer() {
  trianglingSelectedWords = [];
  document.getElementById("triangling-built").textContent = "";
}

function checkTrianglingAnswer() {
  const item = trianglingQueue[trianglingIndex];
  const attempt = trianglingSelectedWords.join(" ").trim();
  if (normalize(attempt) === normalize(item.answer)) {
    submitTrianglingAnswer(item);
  } else {
    document.getElementById("triangling-feedback").textContent = "Not quite — check the story details";
    clearTrianglingAnswer();
  }
}

function submitTrianglingAnswer(item) {
  // FIXED: previously used two stacked fixed setTimeout guesses (1200ms
  // then 1500ms) instead of waiting for the actual clips to finish --
  // same overlapping-audio bug as Circling. Now properly sequenced:
  // answer clip finishes -> confirm clip plays and finishes -> advance.
  playAudio(item.answerAudio, () => {
    playAudio(item.confirmAudio, () => {
      document.getElementById("triangling-feedback").textContent = item.confirm;
      trianglingTuCompleted.add(item.id);
      checkGateProgression();
      trianglingIndex += 1;
      setTimeout(renderTrianglingQuestion, 500);
    });
  });
}

/* ============================================================
   TRIANGLING — él/ella (third-person cross-reference) block.
   Per Triangling_Question_Selection_Spec_V1.md: these ARE
   self-disambiguating regardless of order/context (e.g. "¿Quién es
   un perro?" always means Clifford), unlike the tú-block. Freely
   randomized, no character-blocking needed here.

   Voice: question + confirm = Narrator. Answer = generic Male
   voice (the class collectively, not any one character's own
   voice) -- same single-tap pattern as Circling, since there's no
   personal voice to break down word-by-word here.
   ============================================================ */

let elellaQueue = [];
let elellaIndex = 0;

function startTrianglingElElla() {
  elellaQueue = [...GAME_DATA.trianglingElElla].sort(() => Math.random() - 0.5);
  elellaIndex = 0;
  renderElEllaQuestion();
}

function renderElEllaQuestion() {
  const container = document.getElementById("elella-container");
  if (!container) return;

  if (elellaIndex >= elellaQueue.length) {
    container.innerHTML = `<p>All done for now!</p>`;
    return;
  }

  const item = elellaQueue[elellaIndex];
  playAudio(item.questionAudio); // Narrator auto-asks

  container.innerHTML = `
    <div id="elella-question">${item.question}</div>
    <div id="elella-answer-input"></div>
    <div id="elella-feedback"></div>
  `;
  const btn = document.createElement("button");
  btn.className = "circling-answer-btn";
  btn.textContent = item.answer;
  btn.onclick = () => {
    flashTap(btn);
    // FIXED: same overlapping-audio bug as Circling/Triangling --
    // fixed setTimeout guesses replaced with real 'ended' sequencing.
    playAudio(item.answerAudio, () => {
      playAudio(item.confirmAudio, () => {
        document.getElementById("elella-feedback").textContent = item.confirm;
        trianglingElEllaCompleted.add(item.id);
        checkGateProgression();
        elellaIndex += 1;
        setTimeout(renderElEllaQuestion, 500);
      });
    });
  };
  document.getElementById("elella-answer-input").appendChild(btn);
}

/* ============================================================
   VOCABULARY MASTERY QUIZ — real test, reusing the exact same
   Leitner engine already proven for Circling (5 boxes, BOX_GAP =
   {1:2,2:4,3:6,4:8}), because "heard once" is not mastery. Matches
   Plan 1's own precedent: Learn -> practice -> real Mastery Test.
   ============================================================ */
let vocabQuizItems = [];
let vocabQuizItemCounter = 0;
let currentVocabQuizItem = null;

const NON_TRANSLATABLE_WORDS = new Set(["Clifford", "Harry", "Lez", "Paula"]);

function initVocabQuiz() {
  // FIXED: previously dropped the "english" field entirely when building
  // this internal list (only word/audio were copied), which is why the
  // correct answer never visibly appeared — its button showed blank/
  // undefined text instead of the real English word. Also now excludes
  // the 4 character names, which aren't really "vocabulary" to translate.
  vocabQuizItems = GAME_DATA.vocabulary
    .filter(v => !NON_TRANSLATABLE_WORDS.has(v.word))
    .map(v => ({
      word: v.word, english: v.english, audio: v.audio,
      currentBox: 0, status: "new", dueAtCount: null,
    }));
  vocabQuizItemCounter = 0;
  renderNextVocabQuizItem();
}

function vocabQuizDue() {
  return vocabQuizItems.filter(it => it.status === "learning" && it.dueAtCount <= vocabQuizItemCounter);
}
function vocabQuizNew() {
  return vocabQuizItems.filter(it => it.status === "new");
}
function pickNextVocabQuizItem() {
  const due = vocabQuizDue();
  if (due.length) return due[Math.floor(Math.random() * due.length)];
  const fresh = vocabQuizNew();
  if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
  return null;
}

function renderNextVocabQuizItem() {
  const container = document.getElementById("vocab-quiz-container");
  if (!container) return;
  const item = pickNextVocabQuizItem();
  currentVocabQuizItem = item;

  if (!item) {
    container.innerHTML = `<p>All Vocabulary words mastered!</p>`;
    return;
  }

  playAudio(item.audio); // hear the Spanish word — the question
  // Options are ENGLISH (the meaning), not Spanish (the sound). Hearing
  // Spanish and picking Spanish just tests spelling recognition, not
  // comprehension — that was the bug. Distractors pulled from other
  // words' English meanings, correct answer is this word's English.
  const distractorEntries = vocabQuizItems
    .filter(v => v.word !== item.word)
    .sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [
    { label: item.english, isCorrect: true },
    ...distractorEntries.map(v => ({ label: v.english, isCorrect: false })),
  ].sort(() => Math.random() - 0.5);

  container.innerHTML = `<div id="vocab-quiz-options"></div><div id="vocab-quiz-feedback"></div>`;
  const optEl = document.getElementById("vocab-quiz-options");
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "circling-answer-btn";
    btn.textContent = opt.label;
    btn.onclick = () => {
      flashTap(btn);
      submitVocabQuizAnswer(opt.isCorrect);
    };
    optEl.appendChild(btn);
  });
}

function submitVocabQuizAnswer(correct) {
  const item = currentVocabQuizItem;
  vocabQuizItemCounter += 1;
  if (item.status === "new") item.status = "learning";
  if (correct) {
    if (item.currentBox === 5) { item.status = "mastered"; item.dueAtCount = null; }
    else { item.currentBox += 1; item.dueAtCount = vocabQuizItemCounter + CIRCLING_BOX_GAP[item.currentBox]; }
  } else {
    item.currentBox = 1;
    item.dueAtCount = vocabQuizItemCounter + CIRCLING_BOX_GAP[1];
  }
  document.getElementById("vocab-quiz-feedback").textContent = correct ? "¡Correcto!" : `"${item.word}" means "${item.english}"`;
  checkGateProgression();
  setTimeout(renderNextVocabQuizItem, 900);
}

/* ============================================================
   VOCABULARY MATCH GAME — practice only, does not gate anything.
   REBUILT: previous version paired each Spanish word with a duplicate
   of itself (no English at all) and hid everything behind "?" tiles
   across all 23 words at once. This version pairs Spanish <-> English
   (the actual point of the exercise), shows everything visibly from
   the start (tap-to-pair, not flip-and-guess), and works in sets of 6
   at a time instead of all 23/24 in one grid.
   ============================================================ */
const MATCH_SET_SIZE = 6;
let matchGameQueue = [];   // remaining vocabulary items not yet done this session
let matchGameTiles = [];
let matchGameSelected = null;
let matchGameLocked = false;

function startVocabMatchGame() {
  matchGameQueue = GAME_DATA.vocabulary
    .filter(v => !NON_TRANSLATABLE_WORDS.has(v.word))
    .sort(() => Math.random() - 0.5);
  loadNextMatchSet();
}

function loadNextMatchSet() {
  const setItems = matchGameQueue.splice(0, MATCH_SET_SIZE);
  if (setItems.length === 0) {
    const container = document.getElementById("match-game-container");
    if (container) container.innerHTML = `<p>Set complete! 🎉</p>
      <button class="circling-answer-btn" onclick="startVocabMatchGame()">Practice again</button>`;
    return;
  }
  const raw = [];
  setItems.forEach((v, i) => {
    raw.push({ pairId: i, side: 'es', label: v.word, audio: v.audio, matched: false });
    raw.push({ pairId: i, side: 'en', label: v.english, audio: null, matched: false });
  });
  matchGameTiles = raw.sort(() => Math.random() - 0.5).map((t, i) => ({ ...t, idx: i }));
  matchGameSelected = null;
  matchGameLocked = false;
  renderMatchGame();
}

function renderMatchGame() {
  const container = document.getElementById("match-game-container");
  if (!container) return;
  container.innerHTML = "";
  matchGameTiles.forEach(tile => {
    if (tile.matched) return; // matched pairs disappear, not hidden behind "?"
    const btn = document.createElement("button");
    btn.className = "word-tile" + (matchGameSelected === tile.idx ? " selected" : "");
    btn.textContent = tile.label; // always visible — no "?" hiding
    btn.onclick = () => handleMatchTileClick(tile.idx);
    container.appendChild(btn);
  });
}

function handleMatchTileClick(idx) {
  if (matchGameLocked) return;
  const tile = matchGameTiles[idx];
  if (tile.matched) return;
  if (tile.audio) playAudio(tile.audio);

  if (matchGameSelected === null) {
    matchGameSelected = idx;
    renderMatchGame();
    return;
  }
  if (matchGameSelected === idx) {
    matchGameSelected = null;
    renderMatchGame();
    return;
  }

  const a = matchGameTiles[matchGameSelected];
  const b = tile;
  const isMatch = a.pairId === b.pairId && a.side !== b.side;
  matchGameSelected = null;

  if (isMatch) {
    matchGameLocked = true;
    a.matched = true; b.matched = true;
    renderMatchGame();
    setTimeout(() => {
      matchGameLocked = false;
      if (matchGameTiles.every(t => t.matched)) {
        loadNextMatchSet();
      } else {
        renderMatchGame();
      }
    }, 300);
  } else {
    renderMatchGame();
  }
}

/* ============================================================
   INTRO STORY — Título / intro lines / Fin. Was recorded and
   tracked in the audio spreadsheet but never actually built into
   the app itself (a real gap found, not a regression). Plays each
   line in sequence, using the same real 'ended'-event sequencing
   already fixed elsewhere tonight -- no guessed timeouts.
   ============================================================ */
let storyIndex = 0;

function playStory() {
  storyIndex = 0;
  document.getElementById("story-container").innerHTML = "";
  playNextStoryLine();
}

function playNextStoryLine() {
  if (storyIndex >= GAME_DATA.story.length) return;
  const line = GAME_DATA.story[storyIndex];
  const container = document.getElementById("story-container");
  const p = document.createElement("p");
  p.textContent = line.text;
  p.className = "story-line";
  container.appendChild(p);
  playAudio(line.audio, () => {
    storyIndex += 1;
    setTimeout(playNextStoryLine, 400);
  });
}
