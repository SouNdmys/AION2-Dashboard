import { IPC_CHANNELS } from "../../shared/ipc";
import { addAccount, deleteAccount, renameAccount, selectAccount } from "../store";
import { readObjectPayload, readOptionalString, readString } from "./guards";
import { registerIpcHandler } from "./register-handler";

export function registerAccountIpcHandlers(): void {
  registerIpcHandler(IPC_CHANNELS.addAccount, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.addAccount;
    const body = readObjectPayload(payload, channel);
    return addAccount(readString(body, "name", channel), readOptionalString(body, "regionTag", channel));
  });
  registerIpcHandler(IPC_CHANNELS.renameAccount, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.renameAccount;
    const body = readObjectPayload(payload, channel);
    return renameAccount(
      readString(body, "accountId", channel),
      readString(body, "name", channel),
      readOptionalString(body, "regionTag", channel),
    );
  });
  registerIpcHandler(IPC_CHANNELS.deleteAccount, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.deleteAccount;
    const body = readObjectPayload(payload, channel);
    return deleteAccount(readString(body, "accountId", channel));
  });
  registerIpcHandler(IPC_CHANNELS.selectAccount, (_event, payload: unknown) => {
    const channel = IPC_CHANNELS.selectAccount;
    const body = readObjectPayload(payload, channel);
    return selectAccount(readString(body, "accountId", channel));
  });
}
