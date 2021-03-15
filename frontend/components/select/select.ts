// =============================================================================
// Select Component
// (c) Mathigon
// =============================================================================


import {isOneOf, Obj} from '@mathigon/core';
import {CustomElementView, ElementView, Observable, register} from '@mathigon/boost';


@register('x-select')
export class Select extends CustomElementView {
  $active!: ElementView;
  $options: Obj<ElementView> = {};

  ready() {
    const $items = this.children;

    this.$active = this.$('.active') || $items[0];
    this.$active.addClass('active');

    for (const [i, $i] of $items.entries()) {
      // Make select elements tabbable
      if (!isOneOf($i.tagName, 'A', 'BUTTON') && !$i.hasAttr('tabindex')) $i.setAttr('tabindex', 0);
      $i.on('click', () => this.makeActive($i));
      this.$options[$i.attr('value') || i] = $i;
    }

    this.trigger('change', this.$active);
  }

  makeActive($el: ElementView) {
    if ($el === this.$active) return;

    this.$active.removeClass('active');
    this.$active = $el;
    $el.addClass('active');
    this.trigger('change', $el);
  }

  protected bindVariable(model: Observable, name: string) {
    model[name] = this.$active.attr('value');
    this.on('change', ($el: ElementView) => model[name] = $el.attr('value'));

    model.watch(() => {
      const $el = this.$options[model[name]];
      if ($el) this.makeActive($el);
    });
  }
}
