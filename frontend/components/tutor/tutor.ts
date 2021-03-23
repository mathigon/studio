// =============================================================================
// Tutor Component
// (c) Mathigon
// =============================================================================


import {isOneOf, loop, Obj, wait} from '@mathigon/core';
import {Random} from '@mathigon/fermat';
import {Expression} from '@mathigon/hilbert';
import {$N, animate, Browser, CustomElementView, ElementView, post, register} from '@mathigon/boost';
import {Course} from '../../course';
import template from './tutor.pug';


export interface HintOptions {
  class?: string;
  visible?: boolean;
  store?: boolean;
  force?: boolean;
  variables?: Obj<any>;
  timeout?: number;
  toast?: boolean;
}

const MATHS_REGEX = /[0-9+\-*/()^\s]+/g;

const correctImg = loop(Random.shuffle(['happy', 'spongebob', 'sloth', 'party',
  'robot', 'excited', 'cute', 'highfive1', 'applause', 'highfive2']));

const incorrectImg = loop(Random.shuffle(['minions', 'panther', 'dog', 'snape',
  'what', 'door', 'horrible']));

function createMsgElement(content: string, kind: string,
    options: HintOptions = {}) {
  const $wrap = $N('div', {class: 'msg-wrap', 'data-display': 'flex'});
  const $bubble = $N('div', {class: 'msg ' + kind}, $wrap);

  if (options.class) $bubble.addClass(options.class);
  if (!options.visible) $wrap.hide();

  if (isOneOf(kind, 'hint', 'question')) {
    $bubble.html = content;
  } else if (kind === 'img') {
    $bubble.css('background-image', `url(${content})`);
  } else if (kind === 'video') {
    $N('iframe', {src: content, allowfullscreen: true}, $bubble);
  }

  return $wrap;
}


// -----------------------------------------------------------------------------
// Component

@register('x-tutor', {template})
export class Tutor extends CustomElementView {
  private $course?: Course;
  private $toasts!: ElementView;
  private $chat!: ElementView;
  private $chatBody!: ElementView;
  private $query!: ElementView;

  private recentMessages: string[] = [];
  private isOpen = false;
  private queuePromise = Promise.resolve();

  hints!: Record<string, string|string[]>;
  correct!: () => string;
  incorrect!: () => string;

  ready() {
    this.$course = this.parents('x-course')[0] as Course|undefined;
    this.hints = this.$course ? JSON.parse(this.$course.$('#hints')!.text) : {};
    const user = window.user;

    this.correct = loop(Random.shuffle(this.hints.correct as string[] || []));
    this.incorrect = loop(Random.shuffle(this.hints.incorrect as string[] || []));

    this.$toasts = this.$('.toasts')!;
    this.$chat = this.$('.chat')!;
    this.$chatBody = this.$('.chat-body')!;

    // Open the chat panel when a message is clicked
    this.$toasts.on('click', e => {
      if (!e.handled) this.open();
    });
    this.$('.close')!.on('click', () => this.close());

    // Custom query input box
    const $footer = this.$('.chat-footer')!;
    this.$query = $footer.$('.input')!;
    this.$query.onKeyDown('enter', e => {
      e.preventDefault();
      this.askQuestion(this.$query.text.trim());
      this.$query.text = '';
    });
    this.$query.on('focus', () => $footer.addClass('focus'));
    this.$query.on('blur', () => $footer.removeClass('focus'));

    // Hint and Tutorial Button
    this.$('.hint')!.on('click', () => {
      // TODO Show tailored hints for current section
      this.queue(this.hints.tutorial1 as string);
      this.queue(user ? this.hints.tutorial2 as string : this.hints.account as string);
    });

    // Restore previous messages for user
    if (this.$course && this.$course.userData?.messages) {
      for (const m of this.$course.userData.messages) {
        this.$chatBody.append(
            createMsgElement(m.content, m.kind || 'hint', {visible: true}));
      }
    }

    // Show a welcome message or account creation prompt. Note that the
    // corresponding messages (e.g. welcomeMorningNamed) have to be defined
    // in the shared/hints.yaml configuration file (and its translations).
    const showWelcome = (ENV === 'MOBILE') ? window.showWelcomeMessage : !Browser.getCookie('sessionWelcome');
    if (showWelcome && this.$course) {
      if (ENV === 'WEB') Browser.setCookie('sessionWelcome', 1, 60 * 60 * 4);  // 4 hours

      const t = new Date().getHours();
      const time = (t < 12) ? 'Morning' : (t < 18) ? 'Afternoon' : 'Evening';

      if (user) {
        setTimeout(() => this.showHint(`welcome${time}Named`, {variables: {name: user.shortName}}), 3000);
      } else if (Browser.getCookie('welcome')) {
        setTimeout(() => this.showHint(`welcome${time}`), 3000);
        if (ENV === 'WEB') setTimeout(() => this.queue(this.hints.account as string), 4500);
      } else {
        Browser.setCookie('welcome', 1);
        setTimeout(() => this.queue(this.hints.welcome as string), 3000);
        if (ENV === 'WEB') setTimeout(() => this.queue(this.hints.tutorial1 as string), 4500);
      }
    }
  }

  // ---------------------------------------------------------------------------

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.$chat.enter('slide-up', 200);
    this.$chatBody.scrollTop = this.$chatBody.scrollHeight;
    this.trigger('open');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.$query.blur();
    this.trigger('close');
    this.$chat.exit('slide-down', 200);
  }

  queue(content: string, kind = 'hint', options: HintOptions = {}) {
    this.queuePromise = this.queuePromise.then(() => {
      this.display(content, kind, options);
      return wait(500);
    });
  }

  display(content: string, kind = 'hint', options: HintOptions = {}) {
    let timeout = options.timeout || 8000;
    if (Browser.width < 640) timeout *= 0.7;  // Shorter timeout on mobile.

    const toast = (options.toast == undefined) ? true : options.toast;
    if (toast && !this.isOpen) {
      const $toast = createMsgElement(content, kind, options);
      $toast.setAttr('role', 'alert');
      this.$toasts.append($toast);
      $toast.enter('reveal-right');
      setTimeout(() => $toast.exit('reveal-right', 400, 0, true), timeout);
      this.on('open', () => $toast.exit('reveal', 200, 0, true));
    }

    const $chat = createMsgElement(content, kind, {class: options.class, visible: !this.isOpen});
    this.$chatBody.append($chat);
    if (this.isOpen) {
      $chat.enter('reveal', 300);
      animate(() => this.$chatBody.scrollTop = this.$chatBody.scrollHeight, 200);
    }
  }

  // ---------------------------------------------------------------------------

  showHint(msg: string, options: HintOptions = {}) {
    if (isOneOf(msg, 'correct', 'incorrect')) {
      const content = (msg === 'correct') ? this.correct() : this.incorrect();
      const timeout = (msg === 'correct') ? 3000 : 5000;
      this.queue(content, 'hint', {class: options.class || msg, timeout});

      // TODO Config option for disabling GIFs, or specifying a different src path.
      if (Math.random() < 0.2) {
        const img = (msg === 'correct' ? correctImg() : incorrectImg());
        const prefix = ENV === 'MOBILE' ? '../..' : '';
        this.queue(`${prefix}/images/gifs/${img}.gif`, 'img', {timeout});
      }

      return {text: content};
    }

    let content = (this.hints[msg] || msg) as string;

    // Replace any variables in the hint text.
    if (options.variables) {
      for (const [key, value] of Object.entries(options.variables)) {
        content = content.replace(new RegExp('\\$' + key, 'g'), value);
      }
    }

    // Don't show the same message twice within 10 seconds.
    if (!options.force && this.recentMessages.includes(msg)) {
      return {text: content};
    }
    this.recentMessages.push(msg);
    setTimeout(() => this.recentMessages.shift(), 10000);

    // Store the message, unless options.store is explicitly set to false.
    if (options.store !== false && this.$course) {
      this.$course.saveProgress({hints: [{content, kind: 'hint'}]});
    }

    this.queue(content, 'hint', {class: options.class});
    return {text: content};
  }

  askQuestion(query: string) {
    if (!query) return;
    this.queue(query, 'question');
    if (this.$course) this.$course.log('Tutor', 'ask', query);

    // Evaluate inline equations directly
    const equation = (query.match(MATHS_REGEX) || [])
        .filter(x => x.length >= 3 && !x.match(/^[\s0-9]+$/));

    if (equation.length) {
      try {
        const expr = Expression.parse(equation[0], true);
        // TODO Use approximate equals symbol when necessary
        const result = Expression.parse('=' + expr.evaluate());
        return this.queue(`<span class="math">${expr.toMathML()}${result.toMathML()}</span>`);
      } catch (e) {
        console.log('Parse Error:', equation[0]);
      }
    }

    this.$chatBody.addClass('loading');

    post(this.attr('api'), {query}).then(res => {
      this.$chatBody.removeClass('loading');
      const data = JSON.parse(res);
      for (const msg of data) this.queue(msg.content, msg.kind);
    }).catch(error => {
      this.$chatBody.removeClass('loading');
      this.queue(this.hints.serverError as string);
      console.error('Tutor Error:', error);
    });
  }
}
