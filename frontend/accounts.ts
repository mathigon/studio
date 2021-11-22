// =============================================================================
// Accounts Scripts
// (c) Mathigon
// =============================================================================


import {$, CustomElementView, FormView, InputView, observe, register, Router} from '@mathigon/boost';
import './main';


// -----------------------------------------------------------------------------
// Password Component

const combinations = ['abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm', '01234567890'];
for (let i = 0; i < 2; ++i) combinations.push(combinations[i].toUpperCase());
for (let i = 0; i < 5; ++i) {
  combinations.push(combinations[i].split('').reverse().join(''));
}

function passwordStrength(q = '') {
  if (q.length < 5) return 'Too Short';

  let p = q.replace(/(.)\1*/, function(x, y) {
    return y;
  });  // repetitions
  p = p.replace(/password/gi, 'p').replace(/mathigon/gi, 'm');

  for (const s of combinations) {
    for (let i = 0; i < s.length - 1; ++i) {
      for (let j = Math.min(p.length, s.length - i); j > 2; --j) {
        const sub = s.substr(i, j);
        p = p.replace(sub, sub[0] + sub[1]);
      }
    }
  }

  let space = 0;
  if (q.match(/[0-9]/)) space += 10;
  if (q.match(/[a-z]/)) space += 26;
  if (q.match(/[A-Z]/)) space += 26;
  if (q.match(/[^0-9a-zA-Z]/)) space += 10;

  const score = p.length * Math.log(space);

  if (score < 30) return 'Weak';
  if (score < 50) return 'OK';
  return 'Strong';
}

const template = `<input name="password" :type="reveal?'text':'password'" required placeholder="Password" pattern=".{4,}" autocomplete="new-password" :class="value.length < 5 ? 'invalid' : ''"/>
<span class="placeholder">Password <span class="strength" :class="strength" :if="strength">(\${strength})</span></span>
<div class="toggle" :class="reveal?'on':''"><x-icon name="eye"></x-icon></div>`;

@register('x-password', {template})
export class Password extends CustomElementView {
  ready() {
    this.bindModel(observe({strength: '', reveal: false}));
    this.$('.toggle')!.on('click', () => this.model.reveal = !this.model.reveal);
    this.$('input')!.change((value) => {
      this.model.strength = value ? passwordStrength(value) : '';
      this.$('input')!.setValidity(value.length < 5 ? 'Please pick a longer password.' : '');
    });
  }
}


// -----------------------------------------------------------------------------
// Routes

Router.setup({
  $viewport: $('main')!,
  preloaded: true,
  click: true,
  history: true,
  initialise: ($el) => {
    for (const $form of $el.$$('form') as FormView[]) {
      $form.on('submit', (e: Event) => {
        if (!$form.isValid) {
          e.preventDefault();
          return false;
        }
      });
    }

    for (const $i of $el.$$('.form-field input')) {
      $i.on('blur invalid valid', () => $i.addClass('dirty'));
    }
    for (const $a of $el.$$('.alert')) {
      $a.$('.close')!.on('click', () => $a.remove());
    }
  }
});

Router.view('/signup', {
  enter($el) {
    const $bday = $el.$('input[name="birthday"]') as InputView;
    $bday.change((date) => {
      const age = (Date.now() - (+new Date(date))) / (1000 * 60 * 60 * 24 * 365);
      if (age < 0 || age > 100) return $bday.setValidity('Please enter a valid date of birth.');
      if (age < 13) return $bday.setValidity('You have to be at least 13 years old to create an account.');
      $bday.setValidity('');
    });
  }
});

Router.paths('/login', '/forgot', '/reset', '/reset/:token', '/profile');
