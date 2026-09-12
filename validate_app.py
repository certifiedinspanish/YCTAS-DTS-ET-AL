#!/usr/bin/env python3
"""
validate_app.py -- regression gate for the Cuatro Amigos / DTS app.

RULE: no DTS_Update_vN is considered ready to ship until this script
prints "ALL CHECKS PASSED". Run it against the three candidate files
before packaging any new version.

Usage:
    python3 validate_app.py path/to/game3.js path/to/index.html path/to/game3_data.json

Each check below encodes one specific rule that was established, broken,
and re-fixed at least once in the conversation that produced this app.
If a check fails, it prints exactly what it found and why that's wrong --
it does not guess at a fix.
"""
import json
import re
import sys

FAILURES = []
PASSES = 0

def check(name, condition, detail=""):
    global PASSES
    if condition:
        PASSES += 1
        print(f"  PASS  {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL  {name}")
        if detail:
            print(f"        {detail}")


def main():
    if len(sys.argv) != 4:
        print("Usage: python3 validate_app.py game3.js index.html game3_data.json")
        sys.exit(2)

    js_path, html_path, data_path = sys.argv[1:4]
    js = open(js_path, encoding="utf-8").read()
    html = open(html_path, encoding="utf-8").read()
    data = json.load(open(data_path, encoding="utf-8"))

    print("=== Character rules ===")
    char_names = {c["name"] for c in data["characters"]}
    check("Exactly 4 characters defined (Paula, Lez, Clifford, Harry)",
          char_names == {"Paula", "Lez", "Clifford", "Harry"},
          f"found: {char_names}")

    # This filter lives in index.html (inline render loop), not game3.js -- confirmed by
    # direct inspection. Check the right file, and require it to appear twice (once for
    # Triangling's char-select, once for DTS's).
    harry_filter_count = len(re.findall(r'c\.name\s*!==\s*["\']Harry["\']', html))
    check("Harry excluded from character-select, in both Triangling and DTS",
          'triangling-char-select' in html and 'id="char-select"' in html and harry_filter_count >= 2,
          f"expected 2+ occurrences of the exclusion filter in index.html, found {harry_filter_count}")

    print()
    print("=== Voice assignment rules ===")
    vocab = data["vocabulary"]
    name_words = {"Clifford", "Harry", "Lez", "Paula"}
    non_translatable = set()
    m = re.search(r'NON_TRANSLATABLE_WORDS\s*=\s*new Set\(\[([^\]]*)\]\)', js)
    if m:
        non_translatable = set(re.findall(r'"([^"]+)"', m.group(1)))
    check("Character names excluded from vocabulary quiz (NON_TRANSLATABLE_WORDS)",
          name_words.issubset(non_translatable),
          f"NON_TRANSLATABLE_WORDS found: {non_translatable}")

    # No Female-voice (f_) file should appear anywhere in the vocabulary or circling question audio
    def all_audio_by_section(section_key):
        found = []
        def walk(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if isinstance(v, str) and v.endswith(".mp3"):
                        found.append(v)
                    walk(v)
            elif isinstance(obj, list):
                for item in obj:
                    walk(item)
        walk(data[section_key])
        return found

    vocab_audio = all_audio_by_section("vocabulary")
    check("No Female-voice (f_) audio in Vocabulary",
          not any(a.startswith("f_") for a in vocab_audio),
          f"offending files: {[a for a in vocab_audio if a.startswith('f_')]}")

    circling_audio = all_audio_by_section("circling")
    check("No Female-voice (f_) audio in Circling",
          not any(a.startswith("f_") for a in circling_audio),
          f"offending files: {[a for a in circling_audio if a.startswith('f_')]}")

    print()
    print("=== Harry-voice rule: no phrase only Harry could say is under Male/Female ===")
    HARRY_ONLY_STEMS = ["soy_pequeno", "soy_un_elefante", "soy_harry", "eres_pequeno",
                        "eres_un_elefante"]
    # eres_pequeno / eres_un_elefante ARE legitimately f_/m_ when Paula/Lez/Clifford is the
    # speaker addressing Harry -- so only check the "soy_*" (Harry speaking of himself) set.
    self_stems = ["soy_pequeno", "soy_un_elefante", "soy_harry"]
    # answerBank["Harry"] is confirmed DEAD CODE: checkSentence() only ever looks up
    # answerBank[currentCharacter.name], and Harry is never a selectable character, so
    # this key can never be reached at runtime. It's expected to contain legacy/wrong-voice
    # content and is deliberately excluded from the live-regression scan below (per Curious
    # C's standing rule: never remove existing data without being told to).
    all_referenced_audio = set()
    def collect_all(obj):
        if isinstance(obj, dict):
            for v in obj.values():
                collect_all(v)
        elif isinstance(obj, list):
            for item in obj:
                collect_all(item)
        elif isinstance(obj, str) and obj.endswith(".mp3"):
            all_referenced_audio.add(obj)
    for key, val in data.items():
        if key == "answerBank":
            for char, entries in val.items():
                if char == "Harry":
                    continue  # confirmed dead, skip
                collect_all(entries)
        else:
            collect_all(val)

    if "Harry" in data.get("answerBank", {}):
        print("  INFO  answerBank['Harry'] (confirmed dead/unreachable) still present -- "
              "expected, not scanned for voice violations, not removed per standing rule.")

    bad_self_voice = []
    for stem in self_stems:
        for prefix in ("f_", "m_"):
            for variant in (f"{prefix}{stem}.mp3", f"{prefix}si_{stem}.mp3", f"{prefix}no_{stem}.mp3"):
                if variant in all_referenced_audio:
                    bad_self_voice.append(variant)
    check("No Harry-self-identity fact voiced as Male/Female anywhere in live data",
          len(bad_self_voice) == 0,
          f"offending files still referenced: {bad_self_voice}")

    print()
    print("=== Answer-phrasing rules (Triangling) ===")
    bad_type_mismatch = []
    bad_old_harry_prefix = []
    for t in data["triangling"]:
        answer = t.get("answer", "")
        ttype = t.get("type", "")
        if answer.startswith("Harry,") or answer.startswith("Harry "):
            bad_old_harry_prefix.append(t["id"])
        if ttype.startswith("yesno") and not answer.startswith("Sí,"):
            bad_type_mismatch.append((t["id"], "yesno-type must start with 'Sí,'", answer))
        elif ttype.startswith("no") and not ttype.startswith("noun") and answer.startswith("Sí"):
            bad_type_mismatch.append((t["id"], "no-type must not start with 'Sí'", answer))
        elif ttype.startswith("eitheror") and (answer.startswith("Sí,") or answer.startswith("No,") or answer.startswith("No.")):
            bad_type_mismatch.append((t["id"], "eitheror-type must be bare (no Sí/No)", answer))

    check("No Triangling answer uses the retired 'Harry, eres...' prefix pattern",
          len(bad_old_harry_prefix) == 0,
          f"offending entries: {bad_old_harry_prefix}")
    check("Every Triangling answer's Sí/No usage matches its type",
          len(bad_type_mismatch) == 0,
          f"offending entries: {bad_type_mismatch}")

    print()
    print("=== Code hygiene ===")
    # A comment explaining that this hack was removed is fine and expected -- only an
    # actual function definition or call site is a real regression.
    real_striplib_usage = re.search(r'function\s+stripLeadingSiNo\s*\(|stripLeadingSiNo\s*\(', js)
    check("stripLeadingSiNo tolerance hack does not exist as actual code",
          real_striplib_usage is None,
          "this hack was deliberately removed once the data carried correct Sí/No -- "
          "its return as real code (not just a comment mentioning it) means a data "
          "problem is being papered over again instead of fixed")

    print()
    print("=== answerBank (DTS) rules ===")
    bad_dts_harry = []
    for char in ("Paula", "Lez", "Clifford"):
        for e in data["answerBank"].get(char, []):
            if e.get("about") == "Harry" and (e["sentence"].startswith("Harry,") or e["sentence"].startswith("Harry ")):
                bad_dts_harry.append((char, e["sentence"]))
    check("No DTS answerBank sentence uses the retired 'Harry, eres...' prefix pattern",
          len(bad_dts_harry) == 0,
          f"offending entries: {bad_dts_harry}")

    print()
    print(f"=== {PASSES} passed, {len(FAILURES)} failed ===")
    if FAILURES:
        print("NOT READY TO SHIP. Fix the above before packaging this as a new version.")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED. Safe to package as a new version.")
        sys.exit(0)


if __name__ == "__main__":
    main()
