# EasySwipe

A simple, lightweight swipe gesture library for React.

## Features

- 🎯 Simple API with React hooks
- 📱 Touch gesture support
- ⚡ Configurable thresholds and velocity
- 🎨 Real-time swipe feedback via callbacks
- 🔒 Direction constraints (horizontal, vertical, or all)
- 🪶 Zero dependencies (except React)

## Usage

### Basic Usage

```tsx
import { useSwipeable } from '@/lib/easySwipe';

function MyComponent() {
  const { ref } = useSwipeable({
    onSwipeLeft: () => console.log('Swiped left!'),
    onSwipeRight: () => console.log('Swiped right!'),
  }, {
    threshold: 80,
    direction: 'horizontal',
  });

  return <div ref={ref}>Swipe me!</div>;
}
```

### With Visual Feedback (Tracked Offset)

```tsx
function MyComponent() {
  const { ref, swipeOffset, direction } = useSwipeable({
    onSwipeLeft: () => deleteItem(),
    onSwipeRight: () => completeItem(),
  }, {
    threshold: 80,
    direction: 'horizontal',
    trackSwipeOffset: true, // Enable offset tracking
  });

  return (
    <div 
      ref={ref}
      style={{
        transform: `translateX(${swipeOffset}px)`,
        transition: swipeOffset === 0 ? 'transform 0.2s' : 'none',
      }}
    >
      Swipe me and I move with your finger!
    </div>
  );
}
```

## API

### `useSwipeable(callbacks, config)`

#### Callbacks

- `onSwipeLeft()` - Called when user swipes left
- `onSwipeRight()` - Called when user swipes right
- `onSwipeUp()` - Called when user swipes up
- `onSwipeDown()` - Called when user swipes down
- `onSwipeStart()` - Called when swipe gesture starts
- `onSwipeMove(distance, direction)` - Called during swipe with current distance and direction
- `onSwipeEnd()` - Called when swipe gesture ends

#### Config

- `threshold` - Minimum distance in pixels to trigger swipe (default: 50)
- `velocityThreshold` - Minimum velocity to trigger swipe (default: 0.3)
- `preventDefaultTouchMove` - Prevent default touch move behavior (default: false)
- `direction` - Allowed swipe directions: 'horizontal' | 'vertical' | 'all' (default: 'all')
- `lockAfterFirstDirection` - Lock to first swipe direction, prevent changing mid-swipe (default: true)
- `trackSwipeOffset` - Track and return current swipe offset for visual feedback (default: false)

#### Return Values

- `ref` - Ref to attach to the swipeable element
- `isSwiping` - Boolean indicating if currently swiping (when `trackSwipeOffset` is true)
- `swipeOffset` - Current swipe distance in pixels (when `trackSwipeOffset` is true)
- `direction` - Current swipe direction (when `trackSwipeOffset` is true)

## Example: Task List Swipe Actions

```tsx
const { ref, swipeOffset } = useSwipeable({
  onSwipeRight: () => completeTask(),
  onSwipeLeft: () => deleteTask(),
}, {
  threshold: 80,
  direction: 'horizontal',
  lockAfterFirstDirection: true, // Once user swipes left or right, lock to that direction
  trackSwipeOffset: true, // Get real-time swipe offset
});

return (
  <div 
    ref={ref}
    style={{
      transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
      transition: swipeOffset === 0 ? 'transform 0.2s ease-out' : 'none',
    }}
  >
    {/* Show action indicators based on swipe direction */}
    {swipeOffset > 0 && <CompleteIcon />}
    {swipeOffset < 0 && <DeleteIcon />}
    Task content
  </div>
);
```

## Direction Locking

By default, `lockAfterFirstDirection` is `true`, which means once the user starts swiping in a direction (e.g., left), they cannot change to the opposite direction (right) in the same gesture. This provides a better UX for actions like swipe-to-delete vs swipe-to-complete.

Set `lockAfterFirstDirection: false` if you want to allow direction changes mid-swipe.

