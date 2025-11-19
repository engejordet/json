export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export interface JsonObject {
  [key: string]: JsonValue
}

export interface JsonArray extends Array<JsonValue> {}

export type FieldKind = 'boolean' | 'number' | 'string' | 'color' | 'object' | 'array'

export interface BaseFieldConfig {
  id: string
  label: string
  /** JSON path segments from the root of the snippet root key, e.g. ["poiInfo", "showLabels"] */
  path: (string | number)[]
  kind: FieldKind
  editable: boolean
}

export interface BooleanFieldConfig extends BaseFieldConfig {
  kind: 'boolean'
  defaultValue: boolean
}

export interface NumberFieldConfig extends BaseFieldConfig {
  kind: 'number'
  defaultValue: number
  min?: number
  max?: number
}

export interface StringFieldConfig extends BaseFieldConfig {
  kind: 'string'
  defaultValue: string
}

export interface ColorFieldConfig extends BaseFieldConfig {
  kind: 'color'
  defaultValue: string
  /** If true, show alpha slider in color picker */
  supportsAlpha: boolean
}

export interface ObjectFieldConfig extends BaseFieldConfig {
  kind: 'object'
  children: FieldConfig[]
}

export interface ArrayFieldConfig extends BaseFieldConfig {
  kind: 'array'
  children: FieldConfig[]
}

export type LeafFieldConfig =
  | BooleanFieldConfig
  | NumberFieldConfig
  | StringFieldConfig
  | ColorFieldConfig

export type FieldConfig =
  | LeafFieldConfig
  | ObjectFieldConfig
  | ArrayFieldConfig

export interface SnippetDefinition {
  id: string
  name: string
  /** e.g. "config.json", "settings.json" */
  fileType: string
  /** e.g. "POI info" – used as accordion group label in editor */
  accordionGroup: string
  /** Original snippet text as provided by admin */
  snippetText: string
  /** Parsed JSON representation of the snippet (root object or value) */
  parsedSnippet: JsonValue
  /** Root key for matching in pasted JSON, e.g. "poiInfo" */
  rootKey: string
  /** Field configuration tree for editable & nested fields */
  fields: FieldConfig[]
  createdAt: string
  updatedAt: string
}

export interface SnippetMetadataUpdate {
  id: string
  name?: string
  fileType?: string
  accordionGroup?: string
  updatedAt?: string
}


