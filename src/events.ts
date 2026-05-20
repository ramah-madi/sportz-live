import { EventEmitter } from "node:events";

class AppEventEmitter extends EventEmitter {}
export const appEvents = new AppEventEmitter();
