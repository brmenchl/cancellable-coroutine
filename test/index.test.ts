import Cancellable from '../src';

describe('Cancellable', () => {
  it('should run', async () => {
    const afterPromise = jest.fn();

    const gen = function*(arg: number) {
      const sum = yield 1 + arg;
      yield new Promise(res => setTimeout(res, 50));
      yield afterPromise(sum);
      expect(afterPromise).toBeCalledWith(2);
      return sum;
    };

    const returnValue = await Cancellable.create(gen)(1);
    expect(returnValue).toEqual(2);
  });

  it('should cancel on yield Error', async () => {
    const afterError = jest.fn();
    const inCatch = jest.fn();

    const gen = function*() {
      try {
        yield new Error('Whoops');
        yield afterError();
      } catch (e) {
        inCatch();
        expect(Cancellable.isCancelError(e)).toEqual(false);
        return e;
      }
    };

    const cancellableTask = Cancellable.create(gen);
    const promise = cancellableTask();
    const returnValue = await promise;
    expect(returnValue).toEqual(new Error('Whoops'));
    expect(Cancellable.isCancelled(cancellableTask)).toEqual(false);
    expect(inCatch).toHaveBeenCalled();
    expect(afterError).not.toHaveBeenCalled();
  });

  it('should reject returned promise on unhandled yield Error in generator', done => {
    const error = new Error('Whoops');
    const gen = function*() {
      yield error;
    };

    const onResolved = jest.fn();

    const cancellableTask = Cancellable.create(gen);
    cancellableTask().then(onResolved, e => {
      expect(e).toBe(error);
      done();
    });
    expect(onResolved).not.toBeCalled();
  });

  it('should cancel on yield rejected Promise', async () => {
    const afterRejectedPromise = jest.fn();
    const inCatch = jest.fn();

    const gen = function*() {
      try {
        yield Promise.reject('Whoops');
        yield afterRejectedPromise();
      } catch (e) {
        inCatch();
        expect(Cancellable.isCancelError(e)).toEqual(false);
        return e;
      }
    };

    const cancellableTask = Cancellable.create(gen);
    const promise = cancellableTask();
    const returnValue = await promise;
    expect(returnValue).toEqual('Whoops');
    expect(Cancellable.isCancelled(cancellableTask)).toEqual(false);
    expect(inCatch).toHaveBeenCalled();
    expect(afterRejectedPromise).not.toHaveBeenCalled();
  });

  it('should reject returned promise on unhandled yield rejected Promise in generator', done => {
    const rejectedPromise = Promise.reject('Whoops');
    const gen = function*() {
      yield rejectedPromise;
    };

    const onResolved = jest.fn();

    const cancellableTask = Cancellable.create(gen);
    cancellableTask().then(onResolved, e => {
      expect(e).toEqual('Whoops');
      done();
    });
    expect(onResolved).not.toBeCalled();
  });

  it('should cancel on task cancel call', async () => {
    const afterDelay = jest.fn();
    const inCatch = jest.fn();

    const cancellableTask = Cancellable.create(function*() {
      try {
        yield new Promise(res => setTimeout(res, 100));
        yield afterDelay();
      } catch (e) {
        inCatch(e.message);
        expect(Cancellable.isCancelError(e)).toEqual(true);
        return e;
      }
    });

    const promise = cancellableTask();
    Cancellable.cancel(cancellableTask, 'Took too long');
    await promise;
    expect(Cancellable.isCancelled(cancellableTask)).toEqual(true);
    expect(inCatch).toHaveBeenCalledWith('Took too long');
    expect(afterDelay).not.toHaveBeenCalled();
  });

  it('should reject returned promise on unhandled CancelError in generator', done => {
    const onResolved = jest.fn();

    const cancellableTask = Cancellable.create(function*() {
      yield new Promise(res => setTimeout(res, 100));
    });

    cancellableTask().then(onResolved, e => {
      expect(Cancellable.isCancelError(e)).toBe(true);
      expect(e).toEqual(new Cancellable.CancelError('Took too long'));
      done();
    });
    Cancellable.cancel(cancellableTask, 'Took too long');
    expect(onResolved).not.toBeCalled();
  });

  it('should cancel multiple tasks', async () => {
    const afterDelay = jest.fn();
    const inCatch = jest.fn();

    const fn = function*() {
      try {
        yield new Promise(res => setTimeout(res, 100));
        yield afterDelay();
      } catch (e) {
        inCatch(e.message);
        expect(Cancellable.isCancelError(e)).toEqual(true);
        return e;
      }
    };

    const cancellableTask1 = Cancellable.create(fn);
    const cancellableTask2 = Cancellable.create(fn);

    const promise1 = cancellableTask1();
    const promise2 = cancellableTask2();
    Cancellable.cancel([cancellableTask1, cancellableTask2], 'CANCELLING');
    await promise1;
    await promise2;
    expect(Cancellable.isCancelled(cancellableTask1)).toEqual(true);
    expect(Cancellable.isCancelled(cancellableTask2)).toEqual(true);
    expect(inCatch).toHaveBeenCalledTimes(2);
    expect(inCatch).toHaveBeenCalledWith('CANCELLING');
    expect(afterDelay).not.toHaveBeenCalled();
  });
});
