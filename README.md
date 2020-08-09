# Cancellable-Coroutine

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/brmenchl/cancellable-coroutine/CI)
![npm (tag)](https://img.shields.io/npm/v/cancellable-coroutine/latest)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/cancellable-coroutine)

Cancellable-coroutine is a wrapper for function generators that runs them as async functions and adds cancellation support.

- [Cancellable-Coroutine](#cancellable-coroutine)
  - [Usage](#usage)
  - [API](#api)
    - [`create(generatorFn)`](#creategeneratorfn)
    - [`cancel(cancellableTask)`](#cancelcancellabletask)
    - [`CancelError`](#cancelerror)
    - [`isCancelError(error)`](#iscancelerrorerror)
    - [`isCancelled(cancellableTask)`](#iscancelledcancellabletask)
  - [Not Implemented](#not-implemented)

## Usage

```typescript
// Take a generator function
const myFn = function*(url) {
  // Maybe you want some API data
  const response = yield fetchSomething(url);
  // Maybe you want to delay for some ms
  yield delay(500);
  console.log(response);
  return response;
};

// Wrap the generator in Cancellable.create(...)
const cancellableFn = Cancellable.create(myFn);

// Run the wrapped function, which runs like a function using `async/await`.
// The function returns a promise, which resolves on complete, or rejects on uncaught exception or cancellation.
cancellableFn('https://my-api.com').then(onComplete, onFailureOrCancel);

// Now we can halt the execution of our generator function whenever we want! We use Cancellable.cancel(..) to cancel.
setTimeout(() => {
  Cancellable.cancel(cancellableFn);
}, 200);
```

## API

### `create(generatorFn)`

Returns a `CancellableTask`.

When calling this `CancellableTask`, `generatorFn` will run like an `async/await` function (all `yield` expressions will resolve in sequence).

```typescript
const task = Cancellable.create(function*() {
  const result1 = yield doAThing();
  const result2 = yield doAnAsyncThing(result1);
  return yield doAThirdThing(result2);
};

/*
  this task will run like:
  async function() {
    const result1 = await doAThing();
    const result2 = await doAnAsyncThing(result1);
    return await doAThirdThing(result2);
  }
*/
task();
```

### `cancel(cancellableTask)`

Cancels `cancellableTask`.

If `cancellableTask` is running, a `CancelError` will be thrown in the wrapped generator function. If the task is not running, nothing will happen.

```typescript
const task = Cancellable.create(function*() {
  try {
    yield doAThingThatTakes5Seconds();
    // We want to cancel before this line.
    console.log("We did it!");
  } catch (error) {
    if (Cancellable.isCancelError(error)) {
      console.log("We cancelled!");
    } else {
      console.log("We failed!");
    }
  }
};

task();

setTimeout(() => {
  Cancellable.cancel(task);
}, 1000);

// Only "We cancelled!" will output to the console.
```

### `CancelError`

Extends Error. A CancelError will be thrown into the generator function if it is cancelled while running.

### `isCancelError(error)`

Returns true if the passed error is a CancelError, false otherwise. This can be used in a `catch(error)` block to check whether `error` was caused by cancellation or not.

```typescript
try {
...
} catch (error) {
  if (isCancelError(error)) {
    // We cancelled!
  } else {
    // Something else failed!
  }
}
```

### `isCancelled(cancellableTask)`

Returns true if the passed task has been cancelled. This can be used in a calling function to check whether a called task ran successfully or was cancelled.

```typescript
const task = Cancellable.create(function*() {
  ...
});

task();

Cancellable.cancel(task);

if (Cancellable.isCancelled(task)) {
  // task was cancelled!
}
```

## Not Implemented

- Returned Promise rejects on uncaught Error or CancelError
- Pass argument to generator function
