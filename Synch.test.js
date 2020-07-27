import * as Synch from "./Synch";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Handler {
  constructor(mutex, threadName) {
    this.mutex = mutex;
    this.threadName = threadName;
    this.marker = null;
  }

  async lockAndRelease() {
    await this.lock();
    this.release();
  }

  async lock() {
    await this.mutex.acquire();
    this.marker = Date.now();
  }

  release() {
    this.mutex.release();
  }

  timeDiff(otherHandler) {
    return this.marker - otherHandler.marker;
  }
}

describe("SpinLock", () => {
  it("does not block with single request", () => {
    const lock = new Synch.SpinLock(10000);
    const a = Date.now();
    lock.acquire();
    const b = Date.now();
    lock.release();
    const c = Date.now();
    expect(b - a < 100).toBe(true);
    expect(c - a < 100).toBe(true);
  });

  it("does not block on second request", async () => {
    const lock = new Synch.SpinLock(0);

    const mainThread = new Handler(lock, "main");
    const thread1 = new Handler(lock, "thread-1");
    expect(mainThread.marker).toBeNull();
    expect(thread1.marker).toBeNull();

    await mainThread.lockAndRelease();

    expect(mainThread.marker).not.toBeNull();
    expect(thread1.marker).toBeNull();

    await thread1.lockAndRelease();
    expect(mainThread.marker).not.toBeNull();
    expect(thread1.marker).not.toBeNull();
  });

  it("thread1 blocks on main thread", async () => {
    const lock = new Synch.SpinLock(1);

    const mainThread = new Handler(lock, "main");
    const thread1 = new Handler(lock, "thread-1");

    expect(mainThread.marker).toBeNull();
    expect(thread1.marker).toBeNull();

    await mainThread.lock();

    expect(mainThread.marker).not.toBeNull();
    expect(thread1.marker).toBeNull();

    setTimeout(async () => await thread1.lock(), 0);
    await wait(10);
    expect(mainThread.marker).not.toBeNull();
    expect(thread1.marker).toBeNull();
    mainThread.release();
    await wait(10);
    expect(mainThread.marker).not.toBeNull();
    expect(thread1.marker).not.toBeNull();
  });

  it("has a useful isLocked ", async () => {
    const lock = new Synch.SpinLock(0);
    expect(lock.isLocked()).toBeFalsy();
    await lock.acquire();
    expect(lock.isLocked()).toBeTruthy();
    lock.release();
    expect(lock.isLocked()).toBeFalsy();
  });

  it("has a useful try ", async () => {
    const lock = new Synch.SpinLock(0);
    let ticket = lock.try();
    expect(ticket).not.toBeNull();
    ticket = lock.try();
    expect(ticket).toBeNull();
    lock.release();
  });
});

describe("SpinGuard", () => {
  it("protects function calls correctly", async () => {
    const guard = new Synch.SpinGuard(10);
    const startTime = Date.now();
    await guard.acquire();
    expect(guard.isLocked()).toBeTruthy();

    let protectedTime = null;

    setTimeout(
      async () => (protectedTime = await guard.protect(async () => Date.now())),
      1
    );
    expect(protectedTime).toBeNull();
    await wait(100);
    expect(protectedTime).toBeNull();
    guard.release();
    await wait(20);
    expect(protectedTime).not.toBeNull();
    expect(protectedTime).toBeGreaterThan(startTime);
    //expect(timeDiff(startTime, protectedTime)).toBeLessThan(150);
    //expect(timeDiff(startTime, protectedTime)).toBeGreaterThan(100);
  });

  it("protects function calls with predicate", async () => {
    const guard = new Synch.SpinGuard(10);
    const startTime = Date.now();
    await guard.acquire();
    expect(guard.isLocked()).toBeTruthy();

    let protectedTime = null;
    let predicateCount = 0;

    setTimeout(
      async () =>
        (protectedTime = await guard.protect(
          async () => Date.now(),
          async () => ++predicateCount
        )),
      1
    );
    expect(protectedTime).toBeNull();
    await wait(100);
    expect(protectedTime).toBeNull();
    guard.release();
    await wait(20);
    // counts 2 -- WHILE(true), IF(TRUE) then RETURNS Date.now()
    expect(predicateCount).toBe(2);
    expect(protectedTime).not.toBeNull();
    expect(protectedTime).toBeGreaterThan(startTime);
    //expect(timeDiff(startTime, protectedTime)).toBeLessThan(150);
    //expect(timeDiff(startTime, protectedTime)).toBeGreaterThan(100);
  });

  it("protects function (but does not call it) with predicate", async () => {
    const guard = new Synch.SpinGuard(10);
    await guard.acquire();
    expect(guard.isLocked()).toBeTruthy();

    let protectedTime = null;
    let predicateCount = 0;

    setTimeout(
      async () =>
        (protectedTime = await guard.protect(
          async () => Date.now(),
          async () => ++predicateCount === 1
        )),
      1
    );
    expect(protectedTime).toBeNull();
    await wait(100);
    expect(protectedTime).toBeNull();
    guard.release();
    await wait(20);
    // counts 3 -- WHILE(true), IF(false), WHILE(false) then RETURNS null
    expect(predicateCount).toBe(3);
    expect(protectedTime).toBeNull();
  });
});

describe("Barrier", () => {
  it("causes no one to wait by default", async () => {
    const barrier = new Synch.Barrier();
    expect(barrier.isLocked()).toBeFalsy();
    await barrier.enter();
  });

  it("starts LOCKED when startLocked = true", async () => {
    const barrier = new Synch.Barrier(true);
    expect(barrier.isLocked()).toBeTruthy();
  });

  it("barriers correctly", async () => {
    const barrier = new Synch.Barrier(true);
    let protectedTime = null;
    setTimeout(async () => {
      await barrier.enter();
      protectedTime = Date.now();
    }, 1);
    expect(protectedTime).toBeNull();
    expect(protectedTime).toBeNull();
    barrier.open();
    await wait(100);
    expect(protectedTime).not.toBeNull();
  });
});
