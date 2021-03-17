// =============================================================================
// Inline Multiple Choice Blank Component
// (c) Mathigon
// =============================================================================


import {list} from '@mathigon/core';
import {Random} from '@mathigon/fermat';
import {Browser, CustomElementView, ElementView, hover, register} from '@mathigon/boost';
import {Step, StepComponent, UserData} from '../step/step';
import template from './blank-mc.pug';


@register('x-blank-mc', {template})
export class BlankMC extends CustomElementView implements StepComponent {
  private $target!: ElementView;
  private $popup!: ElementView;
  private solution!: string;
  done = false;
  solvedBlank?: undefined;

  ready() {
    this.$target = this.$('.target')!;
    this.$popup = this.$('.popup')!;
    const $choices = this.$popup.$$('.choice');

    this.solution = $choices[0].html;

    const order = Random.shuffle(list($choices.length));

    order.forEach(i => {
      this.$popup.append($choices[i]);  // Shuffle choice order.
      $choices[i].on('click', () => {
        this.removeClass('on');
        $choices[i].blur();
        if (i) {
          this.$target.html = $choices[i].html;
          this.addClass('invalid');
          this.trigger('invalid');
        } else {
          this.solve();
          this.trigger('valid', this.solution);
        }
      });
    });

    // Set the 'left' class initially, to avoid page overflow.
    const goLeft = this.$target.bounds.left + this.$popup.width > Browser.width - 15;
    this.setClass('left', goLeft);

    hover(this, {
      enter: () => {
        if (this.done) return;
        this.addClass('on');

        const targetBounds = this.$target.bounds;
        const popupWidth = this.$popup.width;
        const popupHeight = this.$popup.height;

        const maxWidth = Browser.width - 10 - targetBounds.left;
        const spaceOnRight = (popupWidth < maxWidth);
        const spaceOnLeft = (targetBounds.right - popupWidth > 10);
        const spaceBelow = (targetBounds.top + targetBounds.height +
                            popupHeight > Browser.height - 10);

        this.setClass('left', spaceOnLeft && !spaceOnRight);
        this.setClass('top', spaceBelow);
        this.$popup.css('max-width',
            (!spaceOnLeft && !spaceOnRight) ? `${maxWidth}px` : 'none');
      },
      exit: () => {
        this.removeClass('on');
      },
      delay: 100,
      exitDelay: 400,
      $clickTarget: this.$target
    });
  }

  setup($step: Step, goal: string, userData?: UserData) {
    if (userData?.scores?.includes(goal)) this.solve(true);

    this.one('valid', () => {
      $step.addHint('correct');
      $step.score(goal);
    });
    this.on('invalid', e => $step.addHint(e.hint || 'incorrect', {class: 'incorrect'}));
  }

  solve(restore = false) {
    this.done = true;
    this.$target.html = this.solution;
    this.removeClass('on invalid');
    this.addClass('done');
    this.trigger('solve', {solution: this.solution, restore});
    setTimeout(() => this.$popup.remove(), 250);
    this.$target.removeAttr('tabindex');
  }
}
