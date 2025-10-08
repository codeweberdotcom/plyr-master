// ==========================================================================
// RUTUBE plugin
// ==========================================================================

import ui from '../ui';
import { createElement, replaceElement, toggleClass } from '../utils/elements';
import { triggerEvent } from '../utils/events';
import is from '../utils/is';
import { format, generateId } from '../utils/strings';
import { roundAspectRatio, setAspectRatio } from '../utils/style';
import { buildUrlParams } from '../utils/urls';

// Parse RUTUBE ID from URL
function parseId(url) {
  if (is.empty(url)) {
    return null;
  }

  // Extract video ID from various RUTUBE URL formats
  const regex = /^.*(?:rutube\.ru\/video|rutube\.ru\/play\/embed)\/([^/?#&]+)/;
  const match = url.match(regex);
  return match && match[1] ? match[1] : url;
}

// Set playback state and trigger change (only on actual change)
function assurePlaybackState(play) {
  if (play && !this.embed.hasPlayed) {
    this.embed.hasPlayed = true;
  }
  if (this.media.paused === play) {
    this.media.paused = !play;
    triggerEvent.call(this, this.media, play ? 'play' : 'pause');
  }
}

const rutube = {
  setup() {
    // Add embed class for responsive
    toggleClass(this.elements.wrapper, this.config.classNames.embed, true);

    // Set speed options from config
    this.options.speed = this.config.speed.options;

    // Set initial ratio
    setAspectRatio.call(this);

    rutube.ready.call(this);
  },

  // API Ready
  ready() {
    const player = this;
    const config = player.config.rutube;

    // Get the source URL or ID
    let source = player.media.getAttribute('src');

    // Get from <div> if needed
    if (is.empty(source)) {
      source = player.media.getAttribute(player.config.attributes.embed.id);
    }

    const videoId = parseId(source);

    // Build iframe parameters
    const params = buildUrlParams({
      autoplay: player.config.autoplay ? 1 : 0,
      loop: player.config.loop.active ? 1 : 0,
      // Remove controls from iframe since Plyr will handle them
      controls: 0,
    });

    // Create iframe URL
    const iframeSrc = format(player.config.urls.rutube.iframe, `${videoId}?${params}`);

    // Create iframe
    const iframe = createElement('iframe');
    iframe.setAttribute('src', iframeSrc);
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'clipboard-write; autoplay; fullscreen');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('webkitallowfullscreen', '');
    iframe.setAttribute('mozallowfullscreen', '');
    iframe.setAttribute('playsinline', 'true');
    iframe.setAttribute('webkit-playsinline', 'true');

    // Replace media element with iframe
    player.media = replaceElement(iframe, player.media);

    // Set aspect ratio based on video dimensions (default 16:9 for RUTUBE)
    player.embed = {
      hasPlayed: false,
      ratio: roundAspectRatio(16, 9),
    };

    // Set up postMessage communication
    rutube.setupMessageListener.call(player);

    setAspectRatio.call(player);

    // Add throttling for timeupdate events to prevent UI thrashing
    let lastTimeUpdate = 0;
    const TIMEUPDATE_THROTTLE = 100; // ms

    // Set media properties
    player.media.paused = true;
    // Don't set currentTime to 0 to avoid triggering seeking

    // Set default duration if not available
    player.media.duration = 0;

    // Create faux HTML5 API using RUTUBE postMessage API
    player.media.play = () => {
      assurePlaybackState.call(player, true);
      rutube.sendCommand.call(player, 'player:play', {});
      return Promise.resolve();
    };

    player.media.pause = () => {
      assurePlaybackState.call(player, false);
      rutube.sendCommand.call(player, 'player:pause', {});
      return Promise.resolve();
    };

    player.media.stop = () => {
      rutube.sendCommand.call(player, 'player:stop', {});
      player.currentTime = 0;
    };

    // Seeking
    let currentTime = 0;
    Object.defineProperty(player.media, 'currentTime', {
      get() {
        return currentTime;
      },
      set(time) {
        // Only seek if the time difference is significant
        if (Math.abs(currentTime - time) > 1) {
          currentTime = time;
          // Send seek command to RUTUBE
          rutube.sendCommand.call(player, 'player:setCurrentTime', { time });
        } else {
          currentTime = time;
        }
      },
    });

    // Playback speed
    let speed = player.config.speed.selected;
    Object.defineProperty(player.media, 'playbackRate', {
      get() {
        return speed;
      },
      set(input) {
        speed = input;
        triggerEvent.call(player, player.media, 'ratechange');
      },
    });

    // Volume
    let volume = player.config.volume;
    Object.defineProperty(player.media, 'volume', {
      get() {
        return volume;
      },
      set(input) {
        volume = input;
        rutube.sendCommand.call(player, 'player:setVolume', { volume });
        triggerEvent.call(player, player.media, 'volumechange');
      },
    });

    // Muted
    let muted = player.config.muted;
    Object.defineProperty(player.media, 'muted', {
      get() {
        return muted;
      },
      set(input) {
        const toggle = is.boolean(input) ? input : muted;
        muted = toggle;
        rutube.sendCommand.call(player, toggle ? 'player:mute' : 'player:unMute', {});
        triggerEvent.call(player, player.media, 'volumechange');
      },
    });

    // Source
    Object.defineProperty(player.media, 'currentSrc', {
      get() {
        return iframeSrc;
      },
    });

    // Ended
    Object.defineProperty(player.media, 'ended', {
      get() {
        return player.currentTime === player.duration;
      },
    });

    // Set the tabindex to avoid focus entering iframe
    if (player.supported.ui && config.customControls) {
      player.media.setAttribute('tabindex', -1);
    }

    triggerEvent.call(player, player.media, 'timeupdate');
    triggerEvent.call(player, player.media, 'durationchange');

    // Rebuild UI
    if (config.customControls) {
      setTimeout(() => ui.build.call(player), 50);
    }
  },

  // Setup postMessage listener for RUTUBE events
  setupMessageListener() {
    const player = this;

    if (!player.embed) {
      player.embed = {};
    }

    const messageHandler = (event) => {
      // Verify origin for security
      if (!event.origin.includes('rutube.ru')) {
        return;
      }

      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (!message.type) {
          return;
        }

        rutube.handleMessage.call(player, message);
      } catch (error) {
        // Ignore invalid JSON
      }
    };

    window.addEventListener('message', messageHandler);

    // Store reference for cleanup
    player.embed.messageHandler = messageHandler;
  },

  // Handle messages from RUTUBE player
  handleMessage(message) {
    const player = this;
    const { type, data } = message;

    // Debug logging
    if (player.config.debug) {
      console.log('RUTUBE Message:', type, data);
    }

    switch (type) {
      case 'player:ready':
        // Player is ready
        player.media.duration = data.duration || 0;
        triggerEvent.call(player, player.media, 'loadedmetadata');
        triggerEvent.call(player, player.media, 'canplay');
        break;

      case 'player:init':
        // Player initialized
        triggerEvent.call(player, player.media, 'loadeddata');
        break;

      case 'player:changeState':
        // Handle state changes - RUTUBE uses 'status' field
        const state = data.status || data.state;
        switch (state) {
          case 'playing':
            assurePlaybackState.call(player, true);
            triggerEvent.call(player, player.media, 'playing');
            break;
          case 'paused':
            assurePlaybackState.call(player, false);
            break;
          case 'stopped':
            player.media.paused = true;
            triggerEvent.call(player, player.media, 'ended');
            break;
        }
        break;

      case 'player:durationChange':
        if (data.duration && player.media.duration !== data.duration) {
          player.media.duration = data.duration;
          triggerEvent.call(player, player.media, 'durationchange');
        }
        break;

      case 'player:currentTime':
        // RUTUBE sends currentTime and duration in the same event
        if (data.currentTime !== undefined && player.media) {
          const currentTime = data.currentTime;
          const lastCurrentTime = player.media.currentTime;
          const now = Date.now();

          // Throttle timeupdate events to prevent UI thrashing
          if (now - lastTimeUpdate > TIMEUPDATE_THROTTLE) {
            // Only update if time has actually changed significantly
            if (Math.abs(currentTime - lastCurrentTime) > 0.1 || currentTime === 0) {
              player.media.seeking = false;
              player.media.currentTime = currentTime;
              triggerEvent.call(player, player.media, 'timeupdate');
              lastTimeUpdate = now;
            }
          }
        }
        if (data.duration && player.media.duration !== data.duration) {
          player.media.duration = data.duration;
          triggerEvent.call(player, player.media, 'durationchange');
        }
        break;

      case 'player:volumeChange':
        if (data.volume !== undefined) {
          player.config.volume = data.volume;
          triggerEvent.call(player, player.media, 'volumechange');
        }
        break;

      case 'player:error':
        if (data.code) {
          player.media.error = { code: data.code, message: data.text };
          triggerEvent.call(player, player.media, 'error');
        }
        break;

      case 'player:playComplete':
        player.media.paused = true;
        triggerEvent.call(player, player.media, 'ended');
        break;

      case 'player:buffering':
        triggerEvent.call(player, player.media, 'waiting');
        break;

      case 'player:changeFullscreen':
        triggerEvent.call(player, player.media, data.isFullscreen ? 'enterfullscreen' : 'exitfullscreen');
        break;

      default:
        // Handle any other events that might be useful
        if (type.startsWith('player:')) {
          triggerEvent.call(player, player.elements.container, 'statechange', false, {
            type: type,
            data: data,
          });
        }
        break;
    }
  },

  // Send command to RUTUBE player via postMessage
  sendCommand(type, data) {
    if (this.media && this.media.contentWindow) {
      const command = JSON.stringify({ type, data });
      this.media.contentWindow.postMessage(command, '*');
    }
  },
};

export default rutube;
