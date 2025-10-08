# RUTUBE Support for Plyr

This implementation adds RUTUBE video support to the Plyr media player library.

## Features

- Full RUTUBE iframe integration
- PostMessage API for player control
- Responsive design support
- Custom controls integration
- Event handling for all RUTUBE player states
- Support for RUTUBE-specific parameters

## Usage

### Basic HTML Setup

```html
<div
    data-plyr-provider="rutube"
    data-plyr-embed-id="7716bd3e665725c3c008ae7ab4ff02e2"
></div>
```

### JavaScript Initialization

```javascript
const player = new Plyr('[data-plyr-provider="rutube"]', {
    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
    autoplay: false,
    clickToPlay: true,
});
```

### Advanced Configuration

```html
<div
    data-plyr-provider="rutube"
    data-plyr-embed-id="7716bd3e665725c3c008ae7ab4ff02e2?t=30&skinColor=7cb342"
></div>
```

## Supported RUTUBE Parameters

- `t` - Start time in seconds (e.g., `t=30`)
- `skinColor` - Player skin color in hex (e.g., `skinColor=7cb342`)
- `getPlayOptions` - Request additional video metadata

## API Methods

The RUTUBE provider supports all standard Plyr methods:

```javascript
player.play();      // Start playback
player.pause();     // Pause playback
player.stop();      // Stop playback
player.mute();      // Mute audio
player.unmute();    // Unmute audio
player.volume = 0.5; // Set volume (0-1)
player.currentTime = 30; // Seek to time
player.fullscreen.enter(); // Enter fullscreen
```

## Events

The RUTUBE provider emits all standard Plyr events plus RUTUBE-specific events:

```javascript
player.on('ready', () => console.log('Player ready'));
player.on('play', () => console.log('Video playing'));
player.on('pause', () => console.log('Video paused'));
player.on('ended', () => console.log('Video ended'));
player.on('error', (error) => console.log('Error:', error));
player.on('timeupdate', (time) => console.log('Current time:', time));
```

## RUTUBE-Specific Events

- `player:ready` - Player loaded and ready
- `player:changeState` - Playback state changed
- `player:durationChange` - Video duration updated
- `player:currentTime` - Current playback time
- `player:volumeChange` - Volume changed
- `player:error` - Error occurred
- `player:playComplete` - Playback completed
- `player:buffering` - Buffering state
- `player:changeFullscreen` - Fullscreen state changed

## Responsive Design

The RUTUBE provider supports responsive design through CSS:

```css
.plyr--rutube {
    /* Custom styles for RUTUBE videos */
}
```

## Browser Support

- Modern browsers with iframe and postMessage support
- iOS Safari (with playsinline support)
- Android Chrome

## Technical Implementation

The RUTUBE provider:

1. Creates an iframe with the RUTUBE embed URL
2. Establishes postMessage communication with the RUTUBE player
3. Translates RUTUBE events to Plyr events
4. Provides a consistent API across all video providers
5. Handles responsive aspect ratios
6. Supports custom controls integration

## Files Modified

- `src/js/config/types.js` - Added RUTUBE provider detection
- `src/js/config/defaults.js` - Added RUTUBE URL configuration
- `src/js/plugins/rutube.js` - New RUTUBE provider implementation
- `src/js/media.js` - Added RUTUBE initialization
- `src/js/plyr.js` - Added RUTUBE support methods
- `src/sass/plugins/rutube.scss` - RUTUBE-specific styles

## Testing

A test file `test-rutube.html` is provided for development testing.

## License

This implementation follows the same MIT license as the original Plyr library.
