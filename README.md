# synchronization primatives

## SpinLock

acquire and release a "spin lock" implemented thru
setTimeout and Promise.

```js
 const lock = new SpinLock();
  ...
 try {
   lock.acquire();
     ... protected code ...
 } finally {
   // this is here to protect against exceptions in the protected
   // code
   lock.release();
 }
```

```js
  /**
   * if ticket is null the lock is open otherwise the lock is closed
   * (the number is a unix time stamp for when the lock was acquired).
   */
  constructor(pollingPeriodMS = 1000)
```

## SpinGuard

 SpinGuard protect a callback using a SpinLock Mutex
 T is the return type of the callback

 Example...

```js
   let resource;
   const guard = new SpinGuard();

   function protectMe() {
     const response = await fetch(someURL); // allocate
      if (response.ok()) {
         resource = response.json();
      }
     return resource;                        // return it.
   }

    ...
   const r = guard.protect(protectMe, () => resource == null);

   if (r) {
     console.log('we allocated', r);
   } else {
     console.log('someone else allocated the resource before us', resource);
   }
```

## Barrier

/**
 * Barrier wait until a completion event
 *
 * Example...
 */

```js
  /**
   * @param {boolean} startLocked should we start in locked mode
   * @param {number} pollingPeriodMS between lock acquisition attempts
   */
  constructor(startLocked = false, pollingPeriodMS = 1000)
```

```
const barrier = new Barrier();
```

thread1:

```
barrier.enter();

setTimout(() => barrier.open(), 10000)

```

thread2:

```
barrier.enter();  // will block until someone calls barrier.open()

```
