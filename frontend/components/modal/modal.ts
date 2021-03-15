// =============================================================================
// Modal Component
// (c) Mathigon
// =============================================================================


import {$, $$, $body, $N, AnimationResponse, Browser, CustomElementView, ElementView, MediaView, register, Router} from '@mathigon/boost';


const $modalBackground = $N('div', {class: 'modal-background'}, $body);
let backgroundAnimation: AnimationResponse|undefined;

let $openModal: Modal|undefined = undefined;
let lastFocusElement: HTMLElement|undefined = undefined;

function tryClose() {
  if ($openModal && $openModal.canClose) $openModal.close();
}

$modalBackground.on('click', tryClose);
Browser.onKey('escape', tryClose);
Router.on('change', tryClose);

$modalBackground.on('scrollwheel touchmove', (e: Event) => {
  e.preventDefault();
  e.stopPropagation();
});

Browser.onKey('space up down pagedown pageup', (e: Event) => {
  if ($openModal) {
    e.preventDefault();
    e.stopPropagation();
  }
});

// -----------------------------------------------------------------------------

@register('x-modal')
export class Modal extends CustomElementView {
  private isOpen = false;
  private $iframe?: ElementView;
  private $video?: MediaView;
  canClose = true;

  ready() {
    this.canClose = !this.hasAttr('no-close');
    this.$iframe = this.$('iframe[data-src]')!;
    this.$video = this.$('video') as MediaView|undefined;

    const $buttons = $$(`[data-modal=${this.id}]`);
    for (const $b of $buttons) $b.on('click', () => this.open());

    // Look for new modals to open, after browser navigation.
    Router.on('afterChange', ({$viewport}) => {
      const $buttons = $viewport.$$(`[data-modal=${this.id}]`);
      for (const $b of $buttons) $b.on('click', () => this.open());
    });

    // Open modals that are shown on pageload
    if (this.hasClass('open') && !$openModal) this.open(true);

    // Change positioning for modals containing input fields on small screens,
    // to have a better layout when the keyboard panel is shown.
    if (this.$('input')) this.addClass('interactive');

    const $close = this.$('.close');
    if ($close) $close.on('click', () => this.close());

    // Used for Modal.confirm()
    for (const $btn of this.$$('.btn')) $btn.on('click', () => this.trigger('btn-click', $btn));
  }

  open(noAnimation = false) {
    if (this.isOpen) return;

    $modalBackground.setClass('light', this.hasClass('light'));
    if ($openModal) {
      $openModal.close(true);
    } else if (noAnimation) {
      $modalBackground.show();
    } else if ($modalBackground.css('display') === 'block') {
      // Special handling if modals are immediately closed and then opened.
      backgroundAnimation?.cancel();
    } else {
      $modalBackground.enter('fade', 250);
    }

    this.isOpen = true;
    $openModal = this;
    if (this.$iframe) this.$iframe.setAttr('src', this.$iframe.data.src);
    if (this.$video) this.$video.play();

    if (noAnimation) {
      this.show();
    } else {
      this.enter('pop', 250).promise.then(() => this.css('transform', ''));
    }

    this.setAttr('role', 'dialog');
    this.trigger('open');

    lastFocusElement = document.activeElement as HTMLElement;
    const $focus = this.$('input, a, button, textarea, [tabindex="0"]');
    if ($focus) $focus.focus();
  }

  close(keepBg = false, noEvent = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.removeAttr('role');
    $openModal = undefined;

    if (this.$iframe) this.$iframe.setAttr('src', '');
    if (this.$video) this.$video.pause();

    if (!keepBg) backgroundAnimation = $modalBackground.exit('fade', 250);
    this.exit('pop', 250).promise.then(() => this.css('transform', ''));
    if (!noEvent) this.trigger('close');
    if (lastFocusElement) lastFocusElement.focus();
  }

  /**
   * Open a Modal, and wait for one of its buttons to be pressed. It returns the
   * [data-prompt] attribute, or ''.
   */
  static async confirm(selector: string) {
    const modal = $(selector) as Modal|undefined;
    if (!modal) return '';
    modal.open();
    const el = await new Promise<any>(r => modal.one('close btn-click', r));
    modal.close();
    return el?.data?.prompt || '';
  }
}
