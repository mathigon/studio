// =============================================================================
// Inline Variable Component
// (c) Mathigon
// =============================================================================


import {clamp, round} from '@mathigon/fermat';
import {$body, $html, $N, Browser, CustomElementView, ElementView, register, slide} from '@mathigon/boost';
import {Step, StepComponent} from '../step/step';
import template from './variable.pug';


// Prevent other interactions (hover, etc.) while sliding a variable.
const $overlay = $N('div', {class: 'var-overlay'}, $body);


@register('x-var', {template})
export class Variable extends CustomElementView implements StepComponent {
  private min!: number;
  private max!: number;
  private step!: number;
  private valueChange = false;
  private $progress!: ElementView;

  value!: number;
  name!: string;

  ready() {
    const bind = this.attr('bind');
    if (!bind) return;

    const [name, first, info] = bind.split('|');
    [this.min, this.max, this.step] = info.split(',').map(x => +x);

    this.name = name;
    this.model = this.getParentModel();

    this.$('.content')!.bindModel(this.model);
    this.$progress = this.$('.progress')!;

    this.setValue(+first);

    // By default, a 20px shift moves the slider by 1.
    const sensitivity = 20 * (Browser.isMobile ? 1.5 : 1) /
                        clamp((this.max - this.min) / this.step / 12, 1, 3);

    let startPosition = 0;
    let startValue = 0;

    for (const $a of this.$$('.left, .right')) {
      const change = $a.hasClass('left') ? -this.step : this.step;
      $a.on('click', () => {
        this.setValue(this.value + change);
        this.trigger('slide-end');
      });
    }

    slide(this, {
      start: (posn) => {
        startPosition = posn.x;
        startValue = this.value;
        this.addClass('on');
        this.valueChange = false;
        $overlay.show();
        $html.addClass('grabbing');
      },
      move: (posn) => {
        // By default, a 20px shift causes
        const change = (posn.x - startPosition) / sensitivity;
        this.setValue(startValue + round(change) * this.step);
      },
      end: () => {
        this.removeClass('on');
        if (this.valueChange) this.trigger('slide-end');
        $overlay.hide();
        $html.removeClass('grabbing');
      }
    });
  }

  setup($step: Step, goal: string) {
    this.one('slide-end', () => $step.score(goal));
  }

  setValue(v: number) {
    // Note that roundTo can return .000001
    const value = round(clamp(v, this.min, this.max), 2);
    if (value === this.value) return;

    this.value = value;
    this.valueChange = true;
    if (this.model) this.model[this.name] = value;

    const range = this.max - this.min;
    this.$progress.css('width', 116 * (value - this.min) / range + 'px');
  }
}
