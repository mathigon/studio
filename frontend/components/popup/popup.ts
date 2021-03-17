// =============================================================================
// Popup Component
// (c) Mathigon
// =============================================================================


import {Browser, CustomElementView, ElementView, register} from '@mathigon/boost';


@register('x-popup')
export class Popup extends CustomElementView {
  private isOpen = false;
  private animation!: string;
  private $bubble!: ElementView;

  ready() {
    this.animation = this.attr('animation') || 'pop';

    this.$bubble = this.$('.popup-body')!;
    this.$bubble.hide();

    const $target = this.$('.popup-target')!;
    $target.on('click', () => this.toggle());
    this.on('clickOutside', () => this.close());
    for (const $a of this.$bubble.$$('a')) $a.on('click', () => this.close());

    Browser.onKey('escape', () => this.close());
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    this.addClass('active');
    this.$bubble.enter(this.animation, 150);
    this.$bubble.setAttr('role', 'dialog');
    this.$bubble.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.removeClass('active');
    this.$bubble.exit(this.animation, 150);
    this.$bubble.removeAttr('role');
  }
}
