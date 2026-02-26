import type { AccountState, CharacterState } from "../shared/types";

export interface SelectionState {
  selectedAccountId: string | null;
  selectedCharacterId: string | null;
}

export interface ResolveSelectionAfterAccountDeletionInput extends SelectionState {
  accounts: AccountState[];
  characters: CharacterState[];
}

export interface ResolveSelectionForAccountInput extends SelectionState {
  accounts: AccountState[];
  characters: CharacterState[];
  accountId: string;
}

export interface ResolveSelectionAfterCharacterDeletionInput extends SelectionState {
  characters: CharacterState[];
  deletedCharacterId: string;
}

export interface ResolveSelectionForCharacterInput extends SelectionState {
  characters: CharacterState[];
  characterId: string;
}

export function resolveSelectionAfterAccountDeletion(
  input: ResolveSelectionAfterAccountDeletionInput,
): SelectionState {
  const selectedStillExists = input.characters.some((item) => item.id === input.selectedCharacterId);
  const nextSelectedCharacterId = selectedStillExists ? input.selectedCharacterId : (input.characters[0]?.id ?? null);
  const nextSelectedAccountId =
    input.accounts.find((item) => item.id === input.selectedAccountId)?.id ??
    input.characters.find((item) => item.id === nextSelectedCharacterId)?.accountId ??
    input.accounts[0]?.id ??
    null;
  return {
    selectedAccountId: nextSelectedAccountId,
    selectedCharacterId: nextSelectedCharacterId,
  };
}

export function resolveSelectionForAccount(input: ResolveSelectionForAccountInput): SelectionState {
  if (!input.accounts.some((item) => item.id === input.accountId)) {
    return {
      selectedAccountId: input.selectedAccountId,
      selectedCharacterId: input.selectedCharacterId,
    };
  }

  const charInAccount = input.characters.find((item) => item.accountId === input.accountId);
  return {
    selectedAccountId: input.accountId,
    selectedCharacterId: charInAccount?.id ?? input.selectedCharacterId,
  };
}

export function resolveSelectionAfterCharacterDeletion(
  input: ResolveSelectionAfterCharacterDeletionInput,
): SelectionState {
  const nextSelectedCharacterId =
    input.selectedCharacterId === input.deletedCharacterId ? (input.characters[0]?.id ?? null) : input.selectedCharacterId;
  const nextSelectedCharacter =
    input.characters.find((item) => item.id === nextSelectedCharacterId) ?? input.characters[0] ?? null;
  return {
    selectedAccountId: nextSelectedCharacter?.accountId ?? input.selectedAccountId,
    selectedCharacterId: nextSelectedCharacterId,
  };
}

export function resolveSelectionForCharacter(input: ResolveSelectionForCharacterInput): SelectionState {
  const target = input.characters.find((item) => item.id === input.characterId);
  if (!target) {
    return {
      selectedAccountId: input.selectedAccountId,
      selectedCharacterId: input.selectedCharacterId,
    };
  }
  return {
    selectedAccountId: target.accountId,
    selectedCharacterId: target.id,
  };
}
