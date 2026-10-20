/** Which pages are shown together, and which page comes next or before. */
import { appState, settings } from './state.js';

export function viewIndices(index) {
  const wide = (i) => {
    const d = appState.dims && appState.dims[i];
    return !!d && d.w > d.h;
  };
  const arr = [index];
  if (
    appState.viewMode === 'double' &&
    (index > 0 || !settings.coverAlone) &&
    index + 1 < appState.pages.length &&
    !wide(index) &&
    !wide(index + 1)
  )
    arr.push(index + 1);
  if (appState.isRTL && arr.length > 1) arr.reverse();
  return arr;
}

export function getNextIndex() {
  const cur = appState.currentIndex;
  const next = cur + viewIndices(cur).length;
  return next < appState.pages.length ? next : null;
}

export function getPrevIndex() {
  const cur = appState.currentIndex;
  if (cur <= 0) return null;
  const wide = (i) => {
    const d = appState.dims && appState.dims[i];
    return !!d && d.w > d.h;
  };
  if (appState.viewMode === 'double' && cur - 2 >= (settings.coverAlone ? 1 : 0) && !wide(cur - 1) && !wide(cur - 2)) return cur - 2;
  return cur - 1;
}

/** Load-time work, run by main.js in the original order. */
export const steps = [];
