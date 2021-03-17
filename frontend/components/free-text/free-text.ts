// =============================================================================
// Free Text Component
// (c) Mathigon
// =============================================================================


import {throttle} from '@mathigon/core';
import {CustomElementView, ElementView, register} from '@mathigon/boost';
import {Step, StepComponent, UserData} from '../step/step';
import template from './free-text.pug';

const MIN_LENGTH = 40;
const DATA_KEY = 'free-text';


@register('x-free-text', {template})
export class FreeText extends CustomElementView implements StepComponent {

  setup($step: Step, id: string, userData?: UserData) {
    const $text = this.$('.text-area') as ElementView;
    const $submit = this.$('.toolbar .submit')!;

    // Restore previous text
    let text = userData?.data?.[DATA_KEY] || '';
    if (text) $text.html = text;

    // Rich Text toolbar
    for (const $b of this.$$('.toolbar .command')) {
      const command = $b.data.command!.split(':');
      $b.on('click', () => document.execCommand(command[0], false, command[1]));
      // TODO Code and equation blocks
    }

    // Save changes
    let saved = text;
    const saveChanges = throttle(() => {
      if (saved !== text) $step.storeData(DATA_KEY, text);
      saved = text;
    }, 5000);
    $text.on('change keyup input paste', () => {
      text = $text.html.replace(/&nbsp;/g, ' ').trim().slice(0, 500).trim();
      $submit.setClass('invisible', text.length < MIN_LENGTH);
      saveChanges();
      // TODO "Changes saved" indicator banner
    });

    // Submit Button
    if (userData?.scores?.includes(id)) {
      $submit.remove();
    } else {
      $submit.setClass('invisible', text.length < MIN_LENGTH);
      $submit.on('click', () => {
        saveChanges();
        $step.score(id);
        $submit.exit('pop');
        this.trigger('submit');
      });
    }
  }
}
