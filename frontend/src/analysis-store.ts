// Simple in-memory store to pass the latest analysis between screens.
// History detail is fetched via the API; this is only for the fresh flow.
import type { AnalysisResult } from "./api";

type State = {
  result: AnalysisResult | null;
  personAName: string;
  personBName: string;
  sourceMode: "text" | "image";
  sourceTextPreview: string | null;
  savedId: string | null;
};

const state: State = {
  result: null,
  personAName: "Person A",
  personBName: "Person B",
  sourceMode: "text",
  sourceTextPreview: null,
  savedId: null,
};

export const analysisStore = {
  set(partial: Partial<State>) {
    Object.assign(state, partial);
  },
  get(): State {
    return state;
  },
  clear() {
    state.result = null;
    state.savedId = null;
  },
};
