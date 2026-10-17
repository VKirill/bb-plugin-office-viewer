import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cloneDeck,
  duplicateSlide,
  newDeck,
  parseSlidesDeck,
  reorderSlides,
  removeSlide,
  SLIDES_FORMAT,
  SLIDES_VERSION,
} from "./model.ts";

test("parseSlidesDeck round-trips a new deck", () => {
  const deck = newDeck("Demo");
  const json = JSON.stringify(deck);
  const parsed = parseSlidesDeck(json);
  assert.equal(parsed.format, SLIDES_FORMAT);
  assert.equal(parsed.version, SLIDES_VERSION);
  assert.equal(parsed.name, "Demo");
  assert.equal(parsed.slides.length, 1);
  assert.equal(parsed.activeSlideId, parsed.slides[0]!.id);
});

test("duplicateSlide and reorderSlides keep active slide", () => {
  let deck = newDeck();
  deck = duplicateSlide(deck, deck.slides[0]!.id);
  assert.equal(deck.slides.length, 2);
  const secondId = deck.slides[1]!.id;
  assert.equal(deck.activeSlideId, secondId);
  deck = reorderSlides(deck, 1, 0);
  assert.equal(deck.slides[0]!.id, secondId);
  deck = removeSlide(deck, deck.slides[1]!.id);
  assert.equal(deck.slides.length, 1);
});

test("cloneDeck is independent", () => {
  const deck = newDeck();
  const copy = cloneDeck(deck);
  copy.name = "Other";
  assert.notEqual(deck.name, copy.name);
});
