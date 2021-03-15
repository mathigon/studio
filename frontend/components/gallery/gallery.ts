// =============================================================================
// Gallery Component
// (c) Mathigon
// =============================================================================


import {clamp} from '@mathigon/fermat';
import {$N, Browser, CustomElementView, ease, register, slide} from '@mathigon/boost';
import template from './gallery.pug';


@register('x-gallery', {template})
export class Gallery extends CustomElementView {

  ready() {
    const $wrapper = this.$('.wrapper')!;
    const $panel = this.$('.panel')!;
    const $slides = $panel.children;

    const $next = this.$('.next')!;
    const $back = this.$('.back')!;

    const $dotsBox = this.$('.dots')!;
    const $dots = $slides.map(() => $N('div', {class: 'dot'}, $dotsBox));


    // Rendering ---------------------------------------------------------------

    const slidesCount = $slides.length;
    const staticSlideWidth = +this.attr('slide-width') || undefined;

    let width = this.width;
    let slidesPerPage = 1;
    let slideWidth = width;

    let activeIndex = 0;
    let translateX = 0;

    const setPosition = (offset: number) => {
      translateX = offset;
      $panel.translate(offset, 0);
      this.trigger('move', offset);
    };

    const makeActive = (newIndex: number) => {
      activeIndex = newIndex;
      for (const [i, $d] of $dots.entries()) {
        $d.setClass('on', i >= newIndex && i < newIndex + slidesPerPage);
      }
      $next.setClass('disabled', newIndex === slidesCount - slidesPerPage);
      $back.setClass('disabled', newIndex === 0);
      this.trigger('change', newIndex);
    };

    Browser.onResize(() => {
      width = this.width;
      slidesPerPage =
          staticSlideWidth ? Math.ceil(width / staticSlideWidth) : 1;
      slideWidth = width / slidesPerPage;
      for (const $s of $slides) $s.css('width', slideWidth + 'px');
      $panel.css('width', slidesCount * slideWidth + 'px');
      setPosition(-activeIndex * slideWidth);
      makeActive(activeIndex);
    });


    // Automatic Scrolling -----------------------------------------------------

    let animTiming = 'quad';
    const animDuration = 500;
    let animT: number;
    let animStart: number;
    let animDistance: number;
    let animStartTime: number;
    let animCancel = false;

    const animRender = () => {
      animT = Date.now() - animStartTime;
      setPosition(animStart + animDistance * ease(animTiming, animT / animDuration));

      if (!animCancel && animT < animDuration) {
        requestAnimationFrame(animRender);
      } else {
        this.trigger('slide-end');
      }
    };

    const startAnimationTo = (newIndex: number) => {
      animCancel = false;
      animT = 0;
      animStart = translateX;
      animDistance = -newIndex * slideWidth - translateX;
      animStartTime = Date.now();
      makeActive(newIndex);
      animRender();
    };

    $next.on('click', () => {
      animTiming = 'quad';
      if (activeIndex < slidesCount - slidesPerPage) startAnimationTo(activeIndex + 1);
    });

    $back.on('click', () => {
      animTiming = 'quad';
      if (activeIndex > 0) startAnimationTo(activeIndex - 1);
    });


    // Touch and Mouse Events --------------------------------------------------

    let motionStartPosn: number;
    let pointerStart: number;
    let previousMotionX: number;
    let lastMotionX: number;

    slide($wrapper, {
      start: (posn) => {
        animCancel = true;
        motionStartPosn = translateX;
        pointerStart = posn.x;
        lastMotionX = previousMotionX = pointerStart;
      },
      move: (posn) => {
        previousMotionX = lastMotionX;
        lastMotionX = posn.x;
        const newPosition = motionStartPosn - pointerStart + posn.x;
        const maxScroll = -(slidesCount - slidesPerPage) * slideWidth;

        // Add resistance at ends of slider
        const x = newPosition > 0 ? newPosition / 4 :
                newPosition < maxScroll ?
                maxScroll + (newPosition - maxScroll) / 4 :
                newPosition;

        setPosition(x);
        this.css('pointer-events', 'none');
      },
      end: () => {
        const lastDiff = lastMotionX - previousMotionX;
        const shift = lastDiff > 12 ? 1 : lastDiff < -12 ? -1 : 0;

        animTiming = 'quad-out';
        startAnimationTo(clamp(Math.round(-translateX / slideWidth - shift), 0,
            slidesCount - slidesPerPage));
        setTimeout(() => this.css('pointer-events', 'auto'));
      }
    });
  }
}
