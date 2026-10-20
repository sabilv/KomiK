/** Light, dark and automatic appearance. */
import { splashScreen, themeIcon, themeLabel, themeModeBtn } from './dom.js';
import { appState } from './state.js';
import { showToast } from './ui.js';

export let systemDarkModeQuery;

export function initTheme() {
  const savedTheme = localStorage.getItem('komik_theme_preference') || 'auto';
  appState.themeMode = savedTheme;
  applyTheme();

  systemDarkModeQuery.addEventListener('change', () => {
    if (appState.themeMode === 'auto') {
      applyTheme();
    }
  });
}

export function applyTheme() {
  const html = document.documentElement;
  let isDark = true;

  if (appState.themeMode === 'auto') {
    isDark = systemDarkModeQuery.matches;
    themeLabel.textContent = 'Auto';
  } else if (appState.themeMode === 'dark') {
    isDark = true;
    themeLabel.textContent = 'Dark';
  } else {
    isDark = false;
    themeLabel.textContent = 'Light';
  }

  if (isDark) {
    html.classList.add('dark');
    themeIcon.className = 'fa-solid fa-moon text-apple-blue';
  } else {
    html.classList.remove('dark');
    themeIcon.className = 'fa-solid fa-sun text-apple-amber';
  }
}

/** Initialize theme settings, system query, and toggle listener. */
export function initThemeModule() {
  // Assign before initTheme() so applyTheme() can read .matches.
  systemDarkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  initTheme();
  setTimeout(() => {
    if (splashScreen) {
      splashScreen.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => {
        splashScreen.style.display = 'none';
      }, 500);
    }
  }, 1200);

  if (themeModeBtn) {
    themeModeBtn.addEventListener('click', () => {
      if (appState.themeMode === 'auto') {
        appState.themeMode = 'dark';
      } else if (appState.themeMode === 'dark') {
        appState.themeMode = 'light';
      } else {
        appState.themeMode = 'auto';
      }

      localStorage.setItem('komik_theme_preference', appState.themeMode);
      applyTheme();
      showToast(`Theme: ${appState.themeMode.toUpperCase()}`);
    });
  }
}
