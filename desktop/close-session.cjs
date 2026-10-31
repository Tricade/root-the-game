'use strict';

const { randomUUID } = require('node:crypto');

// Only one close/update request may wait for the renderer's confirmed save.
function createCloseSession({ send, timeout = 12000, timers = globalThis }) {
  let waiting = null;
  return {
    request() {
      if (waiting) return waiting.promise;
      let resolve;
      const token = randomUUID();
      const promise = new Promise((done) => {
        resolve = done;
      });
      const timer = timers.setTimeout(() => {
        if (waiting?.token === token) {
          waiting = null;
          resolve(false);
        }
      }, timeout);
      waiting = { token, promise, resolve, timer };
      try {
        send('desktop:prepare-close', { token });
      } catch {
        this.finish({ token, persisted: false });
      }
      return promise;
    },
    finish(result) {
      if (!waiting || !result || result.token !== waiting.token) return false;
      const pending = waiting;
      waiting = null;
      timers.clearTimeout(pending.timer);
      pending.resolve(result.persisted === true);
      return true;
    },
    cancel() {
      if (waiting) this.finish({ token: waiting.token, persisted: false });
    },
  };
}

module.exports = { createCloseSession };
