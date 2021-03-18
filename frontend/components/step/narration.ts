// =============================================================================
// Text-to-Speech Narration
// (c) Mathigon
// =============================================================================


import {EventTarget} from '@mathigon/core';
import {$body, $N, Browser, ElementView} from '@mathigon/boost';
import {Tabbox} from '../tabbox/tabbox';
import {Step} from './step';


// -----------------------------------------------------------------------------
// Audio Segment Class

type AudioCallback = (options: {ended: boolean}) => void;

export class AudioSegment {
  private readonly player: HTMLAudioElement;
  private clipEndTime = 0;
  private clipCallback?: AudioCallback;

  constructor(url: string) {
    this.player = new Audio(url);
    this.player.preload = 'true';

    this.player.addEventListener('timeupdate', () => {
      if (this.player.currentTime >= this.clipEndTime) {
        this.triggerCallback(true);
      }
    });

    // TODO Better handling for UI play/pause events (e.g. touch bar).
    // this.player.addEventListener('pause', (e: Event) => console.log(e));

    window.addEventListener('beforeunload', () => this.player.pause());
  }

  playClip(start: number, end: number, callback: AudioCallback) {
    this.triggerCallback(false);
    this.player.currentTime = start;
    this.clipEndTime = end;
    this.clipCallback = callback;
    this.player.play();
  }

  private triggerCallback(ended: boolean) {
    if (!this.clipCallback) return;
    const callback = this.clipCallback;
    this.clipCallback = undefined;
    this.player.pause();
    callback({ended});
  }

  pause() {
    this.triggerCallback(false);
  }

  get isPlaying() {
    return !!this.clipCallback;
  }
}


// -----------------------------------------------------------------------------
// Setup

let continuePlaying = false;
let $waitingReveal: ElementView|undefined = undefined;

export class Narration {
  private readonly paragraphs: Paragraph[] = [];

  constructor(private readonly audio: AudioSegment, $step: Step) {
    this.paragraphs = $step.$$('.voice')
        .map($p => new Paragraph($p, audio));

    for (const [i, p] of this.paragraphs.entries()) {
      p.on('end', () => {
        if (this.paragraphs[i + 1]) {
          this.paragraphs[i + 1].play();
        } else {
          const $next = $step.nextStep;
          if ($next && $next.isShown) $next.narration?.play();
        }
      });
    }
  }

  play() {
    if (this.audio.isPlaying || !continuePlaying) return;
    this.paragraphs[0]?.play();
  }
}


// -----------------------------------------------------------------------------
// Paragraphs

export class Paragraph extends EventTarget {
  private playing: Sentence|undefined = undefined;
  private sentences: Sentence[];
  private $button: ElementView;

  constructor(private readonly $p: ElementView, private audio: AudioSegment) {
    super();

    this.sentences = $p.$$('.sentence[data-timings]')
        .map($s => new Sentence($s, audio));

    this.$button = $N('button', {class: 'playback-btn', title: 'Play Narration'});
    this.$button.on('click', () => {
      this.playing ? this.audio.pause() : this.play();
      continuePlaying = !continuePlaying;
      $waitingReveal = undefined;
    });

    $p.prepend(this.$button);
    $p.addClass('sentence-wrap');

    for (const [i, s] of this.sentences.entries()) {
      s.on('end', (playNext: boolean) => {
        this.playing = undefined;
        if (playNext && this.sentences[i + 1]) {
          setTimeout(() => this.play(this.sentences[i + 1]), 200);
        } else {
          this.$button.removeClass('active');
          // TODO Larger pauses between interactive elements
          if (playNext) setTimeout(() => this.trigger('end'), 400);
        }
      });
    }
  }

  play(s?: Sentence) {
    const sentence = s || this.sentences[0];

    // Deal with revealing elements
    const $reveal = sentence.$reveal;
    if ($reveal && $reveal.css('visibility') === 'hidden') {
      this.$button.removeClass('active');
      $waitingReveal = $reveal;
      $reveal.one('reveal', () => {
        if ($waitingReveal === $reveal && !this.audio.isPlaying) {
          this.play(sentence);
        }
      });
      return;
    }

    this.playing = sentence;
    this.playing.play();
    this.$button.addClass('active');

    // Make the current tab active.
    const $tab = this.$p.parents('x-tabbox .tab')[0];
    if ($tab) {
      const $tabBox = $tab.parents('x-tabbox')[0] as Tabbox;
      $tabBox.makeActive($tab.index());
      const active = $tabBox.active;
      $tabBox.one('change', (i: number) => {
        if (this.playing && i !== active) this.audio.pause();
      });
    }

    // Scroll paragraph into view.
    const bounds = this.$p.bounds;
    const dy = bounds.top + bounds.height - Browser.height + 20;
    if (dy > 0) $body.scrollBy(dy + 100);

    // Wait before focus, so that the new paragraph has scrolled into view.
    setTimeout(() => this.$button.focus(), 800);

    // TODO Support Slideshows and Algebra flow
  }
}


// -----------------------------------------------------------------------------
// Sentences

export class Sentence extends EventTarget {
  private readonly start: number;
  private readonly end: number;

  constructor(private readonly $el: ElementView, private readonly audio: AudioSegment) {
    super();
    const timings = $el.attr('data-timings').split('-');
    this.start = +timings[0] / 1000;
    this.end = (+timings[1] - 200) / 1000;
  }

  play() {
    this.$el.addClass('playing');
    this.audio.playClip(this.start, this.end, ({ended}) => {
      this.$el.removeClass('playing');
      this.trigger('end', ended);
    });
  }

  get $reveal() {
    return this.$el.parents('.reveal')[0];
  }
}
