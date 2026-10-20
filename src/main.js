import '@fontsource/plus-jakarta-sans/latin-300.css';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@fortawesome/fontawesome-free/css/regular.min.css';
import './style.css';

import { steps as s0 } from './state.js';
import { steps as s1 } from './dom.js';
import { steps as s2 } from './theme.js';
import { steps as s3 } from './ui.js';
import { steps as s4 } from './files.js';
import { steps as s5 } from './progress.js';
import { steps as s6 } from './bookmarks.js';
import { steps as s7 } from './shelf.js';
import { steps as s8 } from './pages.js';
import { steps as s9 } from './reader.js';
import { steps as s10 } from './pure.js';
import { steps as s11 } from './paging.js';
import { steps as s12 } from './curl.js';
import { steps as s13 } from './epub.js';
import { steps as s14 } from './pwa.js';
import { steps as s15 } from './library.js';
import { steps as s16 } from './guided.js';
import { steps as s17 } from './settingsui.js';

// Everything that used to run at the top level of the single script runs here, in the original order.
[...s0, ...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8, ...s9, ...s10, ...s11, ...s12, ...s13, ...s14, ...s15, ...s16, ...s17]
  .sort((a, b) => a[0] - b[0])
  .forEach(([, run]) => run());
