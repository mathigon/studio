// =============================================================================
// Video Player Component
// (c) Mathigon
// =============================================================================


import {$N, Browser, CustomElementView, Draggable, MediaView, register} from '@mathigon/boost';
import template from './video.pug';


function formatTime(time: number) {
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}


@register('x-video', {template})
export class Video extends CustomElementView {
  private video!: HTMLMediaElement;

  ready() {
    const src = this.attr('src');

    const $wrap = this.$('.video-wrap')!;
    const $video = this.$('video') as MediaView;

    const width = this.attr('width');
    const height = this.attr('height');
    this.css('width', width + 'px');
    $wrap.css('padding-bottom', (+height) / (+width) * 100 + '%');

    $video.setAttr('poster', this.attr('poster') || src.replace(/mp4$/, 'jpg'));
    if (this.hasAttr('loop')) $video._el.loop = true;
    if (!this.hasAttr('audio')) $video._el.muted = true;
    $video._el.preload = (this.attr('preload') === 'no') ? 'metadata' : 'auto';
    $N('source', {src, type: 'video/mp4'}, $video);

    if (this.hasAttr('credit')) {
      this.$('.credit')!.text = this.attr('credit');
    }


    // -------------------------------------------------------------------------
    // Video Events

    const $timelineBar = this.$('.bar')!;
    const $progressBar = this.$('.progress')!;
    const $bufferBar = this.$('.buffer')!;
    const $timecode = this.$('.timecode')!;

    const drag = new Draggable(this.$('.handle')!, {$parent: $timelineBar, moveY: false});
    const video = this.video = $video._el;

    let timelineWidth = this.width - 110;
    Browser.onResize(() => timelineWidth = this.width - 110);

    $video.on('canplay', () => {
      $timecode.text = formatTime(+video.duration);
    });

    $video.on('timeupdate', () => {
      const playedPercent = (video.currentTime / video.duration);
      $progressBar.css('width', playedPercent * 100 + '%');
      $timecode.text = formatTime(+video.currentTime);
      drag.setPosition(playedPercent * timelineWidth, 0);
      this.trigger('timeupdate', video.currentTime);
    });

    $video.on('progress', () => {
      if (video.buffered.length <= 0 || video.duration <= 0) return;
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const bufferedPercent = (bufferedEnd / video.duration) * 100;
      $bufferBar.css('width', bufferedPercent + '%');
    });

    $video.on('ended', () => {
      video.pause();
      this.removeClass('playing');
      this.trigger('end');
    });


    // -------------------------------------------------------------------------
    // Video Controls

    const togglePlayPause = () => (video.paused ? this.play() : this.pause());
    const setPosition = (x: number) =>
      this.setTime(x / timelineWidth * video.duration);

    if (this.hasAttr('hover')) {
      $video.on('mouseover touchstart', () => this.play());
      $video.on('mouseout touchend touchcancel', () => this.pause());
    } else {
      $video.on('click', togglePlayPause);
    }

    if (this.hasAttr('controls')) {
      this.$('.controls')!.show();
      this.$('.play-pause-btn')!.on('click', togglePlayPause);
      drag.on('start', () => this.pause());
      drag.on('drag', ({posn}) => setPosition(posn.x));
      $timelineBar.on('click', (e: MouseEvent) => setPosition(e.offsetX));
    }
  }

  setTime(t: number) {
    this.video.currentTime = t;
  }

  play() {
    this.video.play();
    this.addClass('playing');
    this.trigger('play');
  }

  pause() {
    this.video.pause();
    this.removeClass('playing');
  }
}
