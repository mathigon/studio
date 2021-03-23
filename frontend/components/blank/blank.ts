// =============================================================================
// Inline Blank Component
// (c) Mathigon
// =============================================================================


import {nearlyEquals, parseNumber, toWord} from '@mathigon/fermat';
import {CustomElementView, ElementView, InputView, register} from '@mathigon/boost';
import {Step, StepComponent, UserData} from '../step/step';
import template from './blank.pug';


function parseInput(str: string) {
  if (str.match('^[0-9]+/[0-9]+$')) {
    const frac = str.split('/');
    return (+frac[0]) / (+frac[1]);
  } else {
    return parseNumber(str);
  }
}


@register('x-blank', {template})
export class Blank extends CustomElementView implements StepComponent {
  private $input!: InputView;
  private $target!: ElementView;
  private $step?: Step;

  private solution = '';  // Orignal version of the solution
  private solutionNum = NaN;  // Numeric version of the solution
  private solutionDisplay = '';  // Override the final text in the answer
  private range = 0;

  private input = '';
  private hint = '';
  private attempts = 0;
  private placeholder = '???';
  done = false;

  // Used to answer multiple blanks in any order
  linkedBlanks?: Blank[];
  solvedBlank?: Blank;
  goal!: string;

  ready() {
    this.$input = this.$('input') as InputView;
    this.$target = this.$('.target')!;

    this.solution = this.attr('solution');

    if (this.solution.indexOf('±') >= 0) {
      const split = this.solution.split('±');
      this.solution = split[0].trim();
      this.range = +split[1];
    }

    this.solutionNum = parseInput(this.solution);
    this.solutionDisplay = this.solution;
    this.hint = this.attr('hint');

    this.removeAttr('solution');  // Stop students spying!
    this.removeAttr('hint');

    this.$input.setInputPattern(this.solution);

    if (this.hasAttr('placeholder')) this.placeholder = this.attr('placeholder');
    this.$input.setAttr('placeholder', this.placeholder);
    this.removeAttr('placeholder');

    this.$input.change((value) => {
      this.input = value;
      if (this.isCorrect) {
        this.solve();
        this.trigger('valid', value);
        this.moveCursor();
      }
    });

    this.$input.onKeyDown('enter', () => this.$input.blur());

    this.$input.on('focus', () => {
      this.addClass('on');
      this.removeClass('invalid');
      this.$input.setAttr('placeholder', ' ');
    });

    this.$input.on('blur', () => {
      this.removeClass('on');
      this.setClass('invalid', !!this.input && !this.done);
      this.$input.setAttr('placeholder', this.placeholder);

      if (this.input && !this.done) {
        this.attempts += 1;
        // TODO Support hints for specific misconceptions.
        const hint = this.attempts >= (this.hint ? 4 : 3) ? `Hmmm… maybe try ${this.solution}?` :
                     this.attempts >= 2 ? this.hint : undefined;
        this.trigger('invalid', {hint});
      }
    });
  }

  setup($step: Step, goal: string, userData?: UserData) {
    this.goal = goal;
    this.$step = $step;
    if (userData?.scores?.includes(goal)) this.solve(true);

    this.one('valid', () => {
      $step.addHint('correct');
      $step.score(this.solvedBlank ? this.solvedBlank.goal : goal);
    });
    this.on('invalid', e => $step.addHint(e.hint || 'incorrect', {class: 'incorrect'}));
  }

  get isCorrect() {
    if (this.done) return true;

    // If there are multiple linked blanks, check all of them whether the
    // solution could match one of them.
    if (this.linkedBlanks) {
      const solved = this.linkedBlanks.map(b => b.solvedBlank);

      this.solvedBlank = this.linkedBlanks.find(b => {
        if (b.done && !b.solvedBlank) return false;
        if (solved.includes(b)) return false;
        if (b.checkAnswer(this.input)) return true;
      });

      if (this.solvedBlank) this.solutionDisplay = this.solvedBlank.solution;
      return !!this.solvedBlank;
    }

    return this.checkAnswer(this.input);
  }

  checkAnswer(input: string) {
    const inputNum = parseInput(input);

    if (input.toLowerCase() === this.solution.toLowerCase()) return true;

    // When matching the range, we should resolve with the user input.
    if (this.range && Math.abs(inputNum - this.solutionNum) <= this.range) {
      this.solutionDisplay = input;
      return true;
    }

    // Allow written words, e.g. "twenty"
    return (nearlyEquals(inputNum, this.solutionNum) ||
            toWord(inputNum) === this.solution ||
            input === toWord(this.solutionNum));
  }

  moveCursor() {
    // Move the cursor to the next BlankInput element in the same step, as long
    // as it is visible and there is no Blank element in between.
    if (!this.$step) return;

    const $next = this.$step.$blanks[this.$step.$blanks.indexOf(this) + 1];
    if (!$next || $next.done || $next.tagName === 'X-BLANK-MC') return;
    if ($next.css('visibility') === 'hidden' || !$next.bounds.width) return;

    ($next as Blank).focus();
  }

  solve(restore = false) {
    this.done = true;
    this.$input.remove();
    this.$target.html = this.solutionDisplay;
    this.addClass('done');
    this.trigger('solve', {solution: this.solutionDisplay, restore});
  }

  focus() {
    this.$input.focus();
  }

  blur() {
    this.$input.blur();
  }
}
