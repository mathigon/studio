// =============================================================================
// Image Component
// (c) Mathigon
// =============================================================================


import {$body, $N, Browser, CustomElementView, register} from '@mathigon/boost';
import template from './image.pug';

const SUPPORTS_AR = document.createElement('a').relList.supports('ar');


// -----------------------------------------------------------------------------
// Initialise Lightbox

let isOpen = false;
let transform = {x: 0, y: 0, s: 1};
let $activeImg: ImageView|undefined = undefined;

const $lightbox = $N('div', {class: 'lightbox-overlay'}, $body);
const $lightboxImg = $N('div', {class: 'lightbox-img'}, $lightbox);

function openLightbox($img: ImageView, srcSmall: string, srcLarge: string) {
  isOpen = true;
  $activeImg = $img;
  $lightbox.show();
  $lightboxImg.show();

  const newX = $img.bounds;
  const oldX = $lightboxImg.bounds;

  const x = newX.left + newX.width / 2 - oldX.left - oldX.width / 2;
  const y = newX.top + newX.height / 2 - oldX.top - oldX.height / 2;
  const s = Math.max(newX.width / oldX.width, newX.height / oldX.height);
  transform = {x, y, s};

  $lightboxImg.css('background-image', `url(${srcLarge}), url(${srcSmall})`);
  $lightboxImg.css('transform', `translate(${x}px, ${y}px) scale(${s})`);

  Browser.redraw();
  $lightboxImg.addClass('transitions');
  Browser.redraw();

  $img.css('visibility', 'hidden');
  $lightbox.addClass('on');
  $lightboxImg.css('transform', 'scale(1) translate(0,0)');
}

function closeLightbox() {
  if (!isOpen) return;
  isOpen = false;

  $lightbox.removeClass('on');
  $lightboxImg.setTransform(transform, 0, transform.s);

  setTimeout(() => {
    $activeImg!.css('visibility', 'visible');
    $lightbox.css('display', 'none');
    $lightboxImg.css('transform', 'none');
    $lightboxImg.removeClass('transitions');
  }, 400);
}

$lightbox.on('click touchmove', closeLightbox);
Browser.onKey('escape', closeLightbox);

$lightbox.on('scrollwheel touchmove', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

Browser.onKey('space up down left right pagedown pageup', (e) => {
  if (isOpen) {
    e.preventDefault();
    e.stopPropagation();
  }
});


// -----------------------------------------------------------------------------
// Lazy Loading

/* TODO Enable Lazy Loading
const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NYuXJlAwAGdgJ8zN9bJwAAAABJRU5ErkJggg==';

const pending = new Map<EventTarget, () => void>();

const observer = window.IntersectionObserver ? new IntersectionObserver(els => {
  for (const entry of els) {
    const resolve = pending.get(entry.target);
    if (resolve) resolve();
    observer!.unobserve(entry.target);
  }
}, {rootMargin: '200px 0px 200px 0px'}) : undefined;

function waitForLoad($img: ElementView) {
  if (!observer) return Promise.resolve();
  return new Promise(resolve => {
    pending.set($img._el, resolve);
    observer.observe($img._el);
  });
} */


// -----------------------------------------------------------------------------
// Image Elements

@register('x-img', {template})
export class ImageView extends CustomElementView {

  ready() {
    const src = this.attr('src');
    const $wrap = this.$('.wrap')!;

    const width = this.attr('width');
    const height = this.attr('height');
    this.css('width', width + 'px');
    $wrap.css('padding-bottom', (+height) / (+width) * 100 + '%');

    const $img = $wrap.$('img')!;
    $img.setAttr('src', src);
    $img.setAttr('alt', this.attr('alt') || '');
    $img.setAttr('width', width);
    $img.setAttr('height', height);

    // GIFs replay on click
    if (src.endsWith('.gif')) {
      $img.on('click', () => $img.setAttr('src', src));
    }

    // Captions
    const $credit = $wrap.$('.credit')!;
    const credit = this.attr('credit');
    if (credit) {
      $credit.text = credit;
    } else {
      $credit.remove();
    }

    // Lightboxes
    const $zoom = $wrap.$('.zoom')!;
    if (this.hasAttr('lightbox')) {
      this.addClass('interactive');
      const large = src.replace(/\.(?=[^.]*$)/, '-large.');
      this.on('click', () => openLightbox(this, src, large));
    } else {
      $zoom.remove();
    }

    // Augmented Reality
    if (SUPPORTS_AR && this.hasAttr('ar')) {
      const $a = $N('a', {href: this.attr('ar'), rel: 'ar'});
      $wrap.prepend($a);
      $a.append($img);
    }
  }
}
