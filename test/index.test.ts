import Cancellable from '../src';

describe('Cancellable', () => {
  it('should run', async () => {
    const afterPromise = jest.fn();

    const gen = function*() {
      const sum = yield 1 + 1;
      yield new Promise(res => setTimeout(res, 50));
      yield afterPromise(sum);
      expect(afterPromise).toBeCalledWith(2);
      return sum;
    };

    const returnValue = await Cancellable.create(gen)();
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

  it('should cancel on task cancel call', async () => {
    const afterDelay = jest.fn();
    const inCatch = jest.fn();

    const gen = function*() {
      try {
        yield new Promise(res => setTimeout(res, 100));
        yield afterDelay();
      } catch (e) {
        inCatch();
        expect(Cancellable.isCancelError(e)).toEqual(true);
        return e;
      }
    };

    const cancellableTask = Cancellable.create(gen);
    const promise = cancellableTask();
    Cancellable.cancel(cancellableTask);
    await promise;
    expect(Cancellable.isCancelled(cancellableTask)).toEqual(true);
    expect(inCatch).toHaveBeenCalled();
    expect(afterDelay).not.toHaveBeenCalled();
  });
});
