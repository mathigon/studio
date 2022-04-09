// =============================================================================
// Main Scripts
// (c) Mathigon
// =============================================================================


import {$, $$, $body, $html, bindAccessibilityEvents, Browser, InputView, Modal, Popup, Router} from '@mathigon/boost';

import '@mathigon/boost/components';
import './components/progress/progress';

// See https://github.com/googleanalytics/autotrack
import 'autotrack/lib/plugins/page-visibility-tracker';

bindAccessibilityEvents();


// -----------------------------------------------------------------------------
// HTML Classes

$html.addClass((Browser.isMobile ? 'is' : 'not') + '-mobile');
if (Browser.isSafari) $html.addClass('is-safari');  // SVG  paint-order fix
setTimeout(() => $html.addClass('ready'));

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.keyCode === 9) $html.addClass('is-tabbing');
});

window.addEventListener('mousedown', () => {
  $html.removeClass('is-tabbing');
});


// -----------------------------------------------------------------------------
// Cookies and Privacy

const $cookies = $('.cookie-warning');
if ($cookies) {
  $('#yes-to-cookies')!.on('click', function() {
    $cookies.exit('pop', 300);
    Browser.setCookie('cookie_consent', 1);
  });
}

const $privacyModal = $('x-modal#privacy') as Modal|undefined;
if ($privacyModal) {
  $privacyModal.$('form')!.on('submit', (e: Event) => {
    e.preventDefault();
    fetch('/profile/accept-policies', {method: 'POST'});
    $privacyModal.close();
  });
}

// -----------------------------------------------------------------------------
// Register Service Worker and Web App Banners

navigator.serviceWorker?.register('/service_worker.js', {scope: '/'})
    .catch(() => console.warn('Unable to register Service Worker.'));

window.addEventListener('beforeinstallprompt', (e: any) => {
  e.prompt();
});


// -----------------------------------------------------------------------------
// Header and Language Picker

$('#skip-nav')?.on('click', () => {
  const $main = $('article') || $('.panel.active') || $('.body') || $body;
  $main.$('input, button, a, textarea, [contenteditable], [tabindex]')?.focus();
});

const $popup = $('nav x-popup') as Popup|undefined;
if ($popup) {
  const $buttons = $popup.$$('.popup-body a, .popup-body button');
  for (const $b of $buttons) $b.on('click', () => $popup.close());
}

const $languageLinks = $$('#language .locale-link');
Router.on('change', (path: string) => {
  for (const $l of $languageLinks) $l.setAttr('href', $l.data.host + path);
});

const $darkMode = $('#dark-mode') as InputView|undefined;
if ($darkMode) {
  $darkMode.checked = Browser.theme.isDark;
  $darkMode.on('change', () => Browser.setTheme($darkMode.checked ? 'dark' : 'light'));
}


// -----------------------------------------------------------------------------
// Search Modal

const SEARCH_CACHE: Record<string, string> = {};

const $search = $('#search') as Modal|undefined;
const $input = $search?.$('.form-field input') as InputView;

const $results = $search?.$('.search-body');
SEARCH_CACHE[''] = $results?.html || '';

function cleanSearchInput(str: string) {
  str = str.trim().replace(/\s+/, ' ').toLowerCase().slice(0, 50);
  return (str === 'pi' || str.length >= 3) ? str : '';
}

async function loadSearchResults(str: string) {
  // TODO Show a loading indicator
  str = encodeURIComponent(cleanSearchInput(str));
  if (str in SEARCH_CACHE) return SEARCH_CACHE[str];
  const response = await fetch(`/api/search?q=${str}`);
  if (!response.ok) return SEARCH_CACHE[str] = '';
  // TODO Show an error when a request fails
  return SEARCH_CACHE[str] = await response.text();
}

let lastCount = 0;
let visibleCount = 0;

async function triggerSearch(str: string) {
  const i = (lastCount += 1);
  const results = await loadSearchResults(str);
  if (i <= visibleCount) return;
  visibleCount = i;
  $results!.html = results;
}

$input?.change((str: string) => {
  Browser.setCookie('search', str, 60 * 60 * 24);

  // Client side throttling for search.
  setTimeout(() => {
    if ($input.value === str) triggerSearch(str);
  }, 300);
});

if ($input?.value) {
  // Restore pre-filled values from cookie or query.
  $search!.one('open', () => triggerSearch($input.value));
}
