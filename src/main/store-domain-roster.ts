import { createDefaultAccount, createDefaultCharacter } from "../shared/constants";
import type { AccountState, CharacterState } from "../shared/types";

export interface AddAccountToRosterInput {
  accounts: AccountState[];
  characters: CharacterState[];
  name: string;
  regionTag?: string;
  accountId: string;
  characterId: string;
  nowIso: string;
}

export interface AddCharacterToRosterInput {
  accounts: AccountState[];
  characters: CharacterState[];
  name: string;
  selectedAccountId: string | null;
  requestedAccountId?: string;
  characterId: string;
  nowIso: string;
  maxCharactersPerAccount: number;
}

export interface DeleteAccountFromRosterInput {
  accounts: AccountState[];
  characters: CharacterState[];
  accountId: string;
  fallbackCharacterId: string;
  nowIso: string;
}

export interface DeleteCharacterFromRosterInput {
  accounts: AccountState[];
  characters: CharacterState[];
  characterId: string;
}

export interface RosterWithSelection {
  accounts: AccountState[];
  characters: CharacterState[];
  selectedAccountId: string | null;
  selectedCharacterId: string | null;
}

export interface RosterOnly {
  accounts: AccountState[];
  characters: CharacterState[];
}

export interface CharacterRosterWithSelection {
  characters: CharacterState[];
  selectedAccountId: string | null;
  selectedCharacterId: string | null;
}

export function addAccountToRoster(input: AddAccountToRosterInput): RosterWithSelection {
  const nextName = input.name.trim();
  const account = createDefaultAccount(nextName || `账号 ${input.accounts.length + 1}`, input.accountId);
  if (input.regionTag?.trim()) {
    account.regionTag = input.regionTag.trim();
  }
  const created = createDefaultCharacter(
    `Character ${input.characters.length + 1}`,
    input.nowIso,
    input.characterId,
    account.id,
  );
  return {
    accounts: [...input.accounts, account],
    characters: [...input.characters, created],
    selectedAccountId: account.id,
    selectedCharacterId: created.id,
  };
}

export function renameAccountInRoster(
  accounts: AccountState[],
  accountId: string,
  name: string,
  regionTag?: string,
): AccountState[] {
  return accounts.map((item) =>
    item.id === accountId ? { ...item, name, regionTag: regionTag?.trim() || undefined } : item,
  );
}

export function deleteAccountFromRoster(input: DeleteAccountFromRosterInput): RosterOnly {
  if (input.accounts.length <= 1) {
    throw new Error("至少保留 1 个账号");
  }

  const nextAccounts = input.accounts.filter((item) => item.id !== input.accountId);
  if (nextAccounts.length === input.accounts.length) {
    throw new Error("账号不存在");
  }

  let nextCharacters = input.characters.filter((item) => item.accountId !== input.accountId);
  if (nextCharacters.length === 0) {
    const fallbackAccountId = nextAccounts[0].id;
    nextCharacters = [
      createDefaultCharacter("Character 1", input.nowIso, input.fallbackCharacterId, fallbackAccountId),
    ];
  }

  return {
    accounts: nextAccounts,
    characters: nextCharacters,
  };
}

function resolveTargetAccountIdForCharacterCreate(input: AddCharacterToRosterInput): string {
  if (input.accounts.length === 0) {
    throw new Error("请先新增账号");
  }

  if (input.requestedAccountId && input.accounts.some((item) => item.id === input.requestedAccountId)) {
    return input.requestedAccountId;
  }
  if (input.selectedAccountId && input.accounts.some((item) => item.id === input.selectedAccountId)) {
    return input.selectedAccountId;
  }
  return input.accounts[0].id;
}

export function addCharacterToRoster(input: AddCharacterToRosterInput): CharacterRosterWithSelection {
  const targetAccountId = resolveTargetAccountIdForCharacterCreate(input);
  const currentCount = input.characters.filter((item) => item.accountId === targetAccountId).length;
  if (currentCount >= input.maxCharactersPerAccount) {
    throw new Error(`每个账号最多 ${input.maxCharactersPerAccount} 个角色`);
  }

  const nextName = input.name.trim();
  const created = createDefaultCharacter(
    nextName || `Character ${input.characters.length + 1}`,
    input.nowIso,
    input.characterId,
    targetAccountId,
  );

  return {
    characters: [...input.characters, created],
    selectedAccountId: targetAccountId,
    selectedCharacterId: created.id,
  };
}

export function renameCharacterInRoster(
  characters: CharacterState[],
  characterId: string,
  name: string,
): CharacterState[] {
  const index = characters.findIndex((item) => item.id === characterId);
  if (index < 0) {
    return characters;
  }
  const next = [...characters];
  next[index] = {
    ...next[index],
    name,
  };
  return next;
}

export function deleteCharacterFromRoster(input: DeleteCharacterFromRosterInput): RosterOnly {
  if (input.characters.length <= 1) {
    throw new Error("至少保留 1 个角色");
  }

  const target = input.characters.find((item) => item.id === input.characterId);
  if (!target) {
    throw new Error("角色不存在");
  }
  const accountCharacterCount = input.characters.filter((item) => item.accountId === target.accountId).length;
  if (accountCharacterCount <= 1) {
    throw new Error("每个账号至少保留 1 个角色");
  }

  const nextCharacters = input.characters.filter((item) => item.id !== input.characterId);
  if (nextCharacters.length === input.characters.length) {
    throw new Error("角色不存在");
  }

  const nextAccounts = input.accounts.map((account) => {
    if (account.extraAodeCharacterId !== input.characterId) {
      return account;
    }
    return { ...account, extraAodeCharacterId: undefined };
  });

  return {
    accounts: nextAccounts,
    characters: nextCharacters,
  };
}
