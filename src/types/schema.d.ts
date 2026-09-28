export type AttrType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi-select'
  | 'date'
  | 'checkbox'
  | 'block-ref'

export interface AttrOption {
  id: string
  label: string
  value: string
  color?: string
}

export interface AttrSchemaItem {
  name: string
  type: AttrType
  label?: string
  options?: AttrOption[]
  dateFormat?: string
  numberFormat?: 'number' | 'currency' | 'percent'
}

export interface TypesSchemaStorage {
  version: number
  schemas: Record<string, AttrSchemaItem>
}
