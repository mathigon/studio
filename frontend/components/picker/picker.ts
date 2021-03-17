// =============================================================================
// Picker Component
// (c) Mathigon
// =============================================================================


import {CustomElementView, register} from '@mathigon/boost';
import {Step, StepComponent, UserData} from '../step/step';


@register('x-picker')
export class Picker extends CustomElementView implements StepComponent {
  private correctCount = 0;
  private solvedCount = 0;
  private isSolved = false;

  setup($step: Step, id: string, userData?: UserData) {
    const $items = this.children;
    const itemsClicked = $items.map(() => false);

    for (const [i, $item] of $items.entries()) {
      const error = $item.data.error;
      const className = error ? 'incorrect' : 'correct';
      if (!error) this.correctCount += 1;

      $item.one('click', () => {
        if (itemsClicked[i] || this.isSolved) return;
        $step.addHint(error || 'correct', {class: className});
        $item.addClass(className);
        if (!error) {
          this.solvedCount += 1;
          $step.score('picker-' + i);
          this.checkSolved();
        }
      });
    }

    // Restore previous data
    const scores = userData?.scores?.filter(x => x.startsWith('picker-')) || [];
    for (const score of scores) {
      const i = +score.slice(7);
      itemsClicked[i] = true;
      $items[i].addClass('correct');
    }
    this.solvedCount = scores.length;
    this.checkSolved();
  }

  checkSolved() {
    if (this.solvedCount < this.correctCount) return;
    this.addClass('solved');
    this.isSolved = true;
  }
}
