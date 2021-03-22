// =============================================================================
// Step Class
// (c) Mathigon
// =============================================================================


import {defer, toCamelCase, words} from '@mathigon/core';
import {CustomElementView, ElementView, hover, Observable, observe, register} from '@mathigon/boost';
import {Gesture} from '../gesture/gesture';
import {Course} from '../../course';
import {Blank} from '../blank/blank';
import {BlankMC} from '../blank/blank-mc';
import {HintOptions} from '../tutor/tutor';
import {Narration} from './narration';


// Global variable exposed by the functions.ts files for courses.
// TODO Better code splitting to avoid duplication.
declare global {
  const StepFunctions: Record<string, (step: Step) => void>|undefined;
}

export type UserData = {scores?: string[]; data?: Record<string, any>};

export interface StepComponent {
  setup: ($step: Step, goal: string, initialData?: UserData) => void;
}

async function showReveal($el: ElementView, noDelay = false) {
  if ($el.css('visibility') === 'visible') return;
  $el.data.display = 'visibility';
  const duration = (+$el.data.duration!) || 400;
  const delay = (noDelay ? 0 : 600) + ((+$el.data.delay!) || 0);
  await $el.enter($el.data.animation || 'fade', duration, delay).promise;
  $el.css({opacity: '', transform: ''});  // Reset after animation.
  $el.trigger('reveal');
  $el.removeClass('reveal');
}


@register('x-step')
export class Step extends CustomElementView {
  private $course?: Course;
  private $components!: (ElementView&StepComponent)[];
  private $reveals!: ElementView[];
  private $nextBtn!: ElementView[];
  private userData?: UserData;

  narration?: Narration;
  model: Observable = observe({});
  isShown = false;
  isCompleted = false;
  goals!: string[];
  scores = new Set<string>();
  $blanks!: (BlankMC|Blank)[];

  ready() {
    this.$course = this.parents('x-course')[0] as Course|undefined;
    this.$blanks = this.$$('x-blank, x-blank-mc') as (BlankMC|Blank)[];
    this.$components = this.$$('[goal]') as (ElementView&StepComponent)[];

    this.userData = this.$course?.userData?.steps?.[this.id];
    this.goals = words(this.attr('goals'));

    // Reveals and checkmarks
    this.$reveals = this.$$('.reveal') as ElementView[];
    const $checks = this.$$('.check[data-when]') as ElementView[];
    for (const $el of [...this.$reveals, ...$checks]) {
      this.onScore($el.data.when!, () => showReveal($el));
    }

    // Next Buttons
    this.$nextBtn = this.$$('.next-step');
    for (const [i, $n] of this.$nextBtn.entries()) {
      this.onScore('next-' + i, () => $n.exit('pop'));
      $n.one('click', () => this.score('next-' + i));
    }

    // Targets
    for (const $t of this.$$('.step-target')) {
      if ($t.tagName === 'X-TARGET') continue;
      hover($t, {
        enter: () => {
          const $targets = this.$$('[target~="' + $t.data.to + '"]');
          for (const $x of $targets) $x.addClass('focus');
          this.addClass('focus');
          this.trigger('target-focus', {$targets});
        },
        exit: () => {
          for (const $x of this.$$('.focus')) $x.removeClass('focus');
          this.removeClass('focus');
        }
      });
    }

    // Variables and action buttons
    // TODO Maybe bind the model to the entire step, not just .var classes
    for (const $var of this.$$('.var, .var-action')) {
      $var.bindModel(this.model);
    }

    if (this.$course?.audio) {
      this.narration = new Narration(this.$course.audio, this);
    }
  }

  show() {
    if (this.isShown) return;
    this.isShown = true;

    // Custom Callbacks exposed by functions.ts
    StepFunctions?.[toCamelCase(this.id)]?.(this);

    // Setup all child components
    for (const $c of this.$components) {
      $c.setup(this, $c.attr('goal'), this.userData);
    }

    // Restore all scores
    const scores = this.userData?.scores || [];
    for (const s of scores) this.score(s, false);

    // Start Gestures
    const $gestures = this.$$('x-gesture[target]') as Gesture[];
    setTimeout(() => {
      if (!this.isReady) for (const $g of $gestures) $g.start();
    }, 2000);

    // Trigger Google Analytics Events
    this.$course?.log('Step', 'show', this.id);

    this.trigger('show');
    this.addClass('on');

    // Play Narration
    if (this.narration) setTimeout(() => this.narration!.play(), 400);
  }

  complete() {
    if (this.isCompleted) return;
    if (!this.isShown) this.show();
    this.isCompleted = true;

    for (let i = 0; i < this.$nextBtn.length; ++i) this.score('next-' + i);
    for (const $r of this.$reveals) {
      // TODO Better logic for which reveal elements to show here.
      if (!$r.parents('svg').length) showReveal($r, true);
    }

    this.trigger('complete');
  }

  get isReady() {
    return this.goals.every(g => this.scores.has(g));
  }

  get isPageLoaded() {
    return this.$course ? this.$course.isReady : true;
  }

  /** Manually score a goal for a step, and optionally move on to the next one. */
  score(goal: string, goNext = true) {
    if (this.scores.has(goal)) return;
    this.scores.add(goal);

    this.trigger('score-' + goal);
    this.trigger('score');

    if (this.$course) {
      this.$course.trigger('score');
      this.$course.saveProgress({steps: {[this.id]: {scores: [goal]}}});
      this.$course.log('Step', 'score', this.id + '/' + goal);
    }

    if (goNext && this.isReady && this.$course && this.$course.isReady) {
      setTimeout(() => {
        if (this.$course!.$activeStep === this) this.$course!.nextStep();
      }, 1200);
    }
  }

  /** Store custom data in the progress object for this step. */
  storeData(key: string, value: any) {
    this.$course?.saveProgress({steps: {[this.id]: {data: {[key]: value}}}});
  }

  /** Trigger a callback when one or more coals have been achieved */
  onScore(goalList: string, callback?: () => void) {
    const goals = words(goalList);

    if (goals.every(g => this.scores.has(g))) {
      if (callback) callback();
      return Promise.resolve();
    }

    const deferred = defer();
    const fn = () => {
      if (!goals.every(g => this.scores.has(g))) return;
      if (callback) callback();
      deferred.resolve();
      this.off('score', fn);
    };
    this.on('score', fn);
    return deferred.promise;
  }

  /**
   * Show a message in the tutor panel. Note that no messages are shown during
   * the initial load of the page, including for all steps that have already
   * been revealed.
   */
  addHint(text: string, options: HintOptions = {}) {
    this.trigger('hint', text);
    if (!this.$course?.isReady) return {text};

    if (this.isInViewport) {
      return this.$course.$tutor?.showHint(text, options);
    } else {
      this.one('enterViewport', () => this.$course!.$tutor?.showHint(text, options));
      return {text: this.$course.$tutor?.hints[text] as string || text};
    }
  }

  /**
   * Show a hint after a specific timeout, unless students correctly solve a
   * problem in the meantime.
   */
  delayedHint(callback: () => void, t = 10000) {
    let timeout = setTimeout(callback, t);

    this.on('score', () => {
      clearTimeout(timeout);
      if (!this.isCompleted) timeout = setTimeout(callback, t);
    });

    this.on('complete', () => clearTimeout(timeout));
  }

  get nextStep() {
    if (!this.$course) return undefined;
    const i = this.$course.$steps.indexOf(this);
    return this.$course.$steps[i + 1];
  }

  /** Group multiple blanks together, so that students can answer in any order. */
  groupBlanks(...indices: number[]) {
    const blanks = indices.map(i => this.$blanks[i]) as Blank[];
    for (const b of blanks) b.linkedBlanks = blanks;
  }
}
