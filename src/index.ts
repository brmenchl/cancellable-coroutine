const CANCEL = Symbol('CANCEL');
const IS_CANCELLED = Symbol('IS_CANCELLED');

export class CancelError extends Error {
  constructor(message?: string) {
    super(message); // 'Error' breaks prototype chain here
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = 'CancelError';
  }
}

export type CancellableTask<Args extends ReadonlyArray<unknown>> = {
  (...args: Args): Promise<any>;
  [CANCEL](message?: string): void;
  [IS_CANCELLED](): boolean;
};

export const create = <F extends (...args: any[]) => Generator>(fn: F) => {
  const cancellableTask = ((async (...args: Parameters<F>) => {
    const state = {
      isRunning: true,
      isCancelled: false,
    };
    const { it, result } = runner(fn, ...args);

    cancellableTask[CANCEL] = (message?: string) => {
      if (state.isRunning) {
        const err = new CancelError(message);
        state.isCancelled = true;
        it.throw(err);
      }
    };

    cancellableTask[IS_CANCELLED] = () => state.isCancelled;

    const completion = await result;
    state.isRunning = false;
    return completion;
  }) as unknown) as CancellableTask<Parameters<F>>;

  return cancellableTask;
};

export const cancel = (
  tasks: CancellableTask<any> | CancellableTask<any>[],
  message?: string
) => {
  (Array.isArray(tasks) ? tasks : [tasks]).forEach(task =>
    task[CANCEL](message)
  );
};

export const isCancelled = (task: CancellableTask<any>) => task[IS_CANCELLED]();

export const isCancelError = (error: Error): error is CancelError =>
  error instanceof CancelError;

const Cancellable = {
  CancelError,
  create,
  cancel,
  isCancelled,
  isCancelError,
};

export default Cancellable;

const runner = <F extends (...args: any[]) => Generator>(
  gen: F,
  ...args: Parameters<F>
) => {
  const it = gen(...args);

  const step = async (verb: 'next' | 'throw', arg?: any): Promise<any> => {
    try {
      const result = it[verb](arg);
      if (result.done) {
        return await result.value;
      }
      const value = await result.value;
      if (value instanceof Error) {
        throw value;
      } else {
        return step('next', value);
      }
    } catch (err) {
      return step('throw', err);
    }
  };

  return { it, result: step('next') };
};
