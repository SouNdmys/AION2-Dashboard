import { registerAccountIpcHandlers } from "./ipc/register-account-handlers";
import { registerAppIpcHandlers } from "./ipc/register-app-handlers";
import { registerCharacterIpcHandlers } from "./ipc/register-character-handlers";
import { registerWorkshopIpcHandlers } from "./ipc/register-workshop-handlers";

export function registerIpcHandlers(): void {
  registerAppIpcHandlers();
  registerAccountIpcHandlers();
  registerCharacterIpcHandlers();
  registerWorkshopIpcHandlers();
}
