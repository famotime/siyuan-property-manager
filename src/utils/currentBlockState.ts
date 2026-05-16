export type CurrentBlockKind = 'doc' | 'block'

export interface CurrentBlockState {
  blockId: string | null
  blockKind: CurrentBlockKind | null
  rootId: string | null
}

export interface BlockSelection {
  id: string | null
  kind: CurrentBlockKind | null
}

export function nextCurrentBlockState(
  current: CurrentBlockState,
  next: BlockSelection,
): CurrentBlockState {
  if (!next.id || !next.kind) {
    return {
      blockId: null,
      blockKind: null,
      rootId: null,
    }
  }

  return {
    blockId: next.id,
    blockKind: next.kind,
    rootId: next.kind === 'doc' ? next.id : current.rootId,
  }
}
