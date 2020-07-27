/**
 * this file contains various synchronization tools
 */

export const defaultPredicate = async () => true;

/**
 * acquire and release a "spin lock" implemented thru
 * setTimeout and Promise.
 *
 * const lock = new SpinLock();
 *  ...
 * try {
 *   lock.acquire();
 *     ... protected code ...
 * } finally {
 *   // this is here to protect against exceptions in the protected
 *   // code
 *   lock.release();
 * }
 */
export class SpinLock {
  /**
   * if ticket is null the lock is open otherwise the lock is closed
   * (the number is a unix time stamp for when the lock was acquired).
   */
  constructor(pollingPeriodMS = 1000) {
    /**
     * the period to wait between lock attempts in milliseconds.
     */
    this.pollingPeriodMS = pollingPeriodMS;

    /**
     * @param {number} pollingPeriodMS between lock acquisition attempts
     */
    this.ticket = null;

    /**
     * debug string for last locker
     */
    this.lastOwner = null;
    this.lastDisowner = null;
  }

  /**
   * @returns {boolean} is the lock currently acquired
   */
  isLocked() {
    return this.ticket != null;
  }

  /**
   * Try to acquire a lock or return NULL if it is currently acquired.
   * @returns {?LockTicket} the ticket (if acquired) or NULL (if
   * the lock is currently acquired).
   */
  try(owner) {
    if (this.ticket != null) {
      return null;
    }
    this.lastOwner = owner;
    this.ticket = Date.now();
    return this.ticket;
  }

  /**
   * acquire the lock or spin until it is available
   * @returns {Promise} when resolved the holder will have
   * acquired the lock and must call release to allow others to
   * use the lock.
   */
  async acquire(owner) {
    while (this.ticket != null) {
      await this._waiter(this.pollingPeriodMS);
    }
    this.lastOwner = owner;
    this.ticket = Date.now();
    return this.ticket;
  }

  /**
   * release a lock, does not check if you are the owner
   * @returns {void}
   */
  release(disowner) {
    this.ticket = null;
    this.lastDisowner = disowner;
  }

  /**
   * return a Promise to wait for a certain amount of time.
   * @param {number} periodMS the amount of time to wait.
   * @returns a Promise to wait for a certain amount of time.
   * @private
   */
  _waiter(periodMS) {
    return new Promise((resolve) => {
      setTimeout(resolve, periodMS);
    });
  }
}

/**
 * SpinGuard protect a callback using a SpinLock Mutex
 * T is the return type of the callback
 *
 * Example...
 *
 *   let resource;
 *   const guard = new SpinGuard();
 *
 *   function protectMe() {
 *     const response = await fetch(someURL); // allocate
 *      if (response.ok()) {
 *         resource = response.json();
 *      }
 *     return resource;                        // return it.
 *   }
 *
 *    ...
 *   const r = guard.protect(protectMe, () => resource == null);
 *
 *   if (r) {
 *     console.log('we allocated', r);
 *   } else {
 *     console.log('someone else allocated the resource before us', resource);
 *   }
 */
export class SpinGuard extends SpinLock {
  /**
   * @param {ActionCallback} guardedAction the callback to protect
   * @param {PredicateCallback} predicate whether the lock acquistion
   * need be taken (defaults to () => true)
   * @returns {T} whatever the guardedAction returns OR null
   * if no lock was acquired
   */
  async protect(guardedAction, predicate = defaultPredicate) {
    while (await predicate()) {
      try {
        await this.acquire("protector");
        if (await predicate()) {
          return await guardedAction();
        }
      } finally {
        this.release("protector");
      }
    }
    return null;
  }
}

/**
 * Barrier wait until a completion event
 *
 * Example...
 */
export class Barrier extends SpinLock {
  /**
   * @param {boolean} startLocked should we start in locked mode
   * @param {number} pollingPeriodMS between lock acquisition attempts
   */
  constructor(startLocked = false, pollingPeriodMS = 1000) {
    super(pollingPeriodMS);
    if (startLocked) {
      this.close();
    }
  }

  /**
   * set the barrier ... all enterers will block
   */
  close() {
    this.acquire("barrier");
  }

  /**
   * reset the barrier... all can enter
   */
  open() {
    this.release("barrier");
  }

  /**
   * wait for barrier to open
   */
  async enter() {
    try {
      await this.acquire("protector");
    } finally {
      this.release("protector");
    }
  }
}
