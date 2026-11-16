/**
 * 本插件实际引用的思源内核响应类型（其余见 `siyuan` 包的全局声明）。
 */

interface IResdoOperations {
  doOperations: doOperation[];
  undoOperations: doOperation[] | null;
}

interface IResGetBlockKramdown {
  id: BlockId;
  kramdown: string;
}
