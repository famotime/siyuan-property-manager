# Property Manager

A [SiYuan](https://b3log.org/siyuan/) plugin that displays and edits block attributes in a side dock panel, with document-level and notebook-level attribute statistics.

## Use Cases

### Case 1: Quick Block Attribute Viewing and Editing
When editing notes, if you want to view or modify a block's custom attributes (like tags, categories, status, etc.), you no longer need to go through cumbersome right-click menus. Simply click any block, and the side panel instantly displays all its attributes.

### Case 2: Batch Attribute Management
If you've used the same attribute value across multiple blocks (e.g., `custom-category=Reading Notes`) and want to change it to a new value, you can do it with one click through the "Attribute Statistics" tab, without manually editing each block.

### Case 3: Finding Blocks with Specific Attributes
Want to find all blocks marked with a specific custom attribute? The attribute statistics feature groups all values by attribute name, showing usage counts, and lets you quickly jump to any block.

## Features

### Attribute Editing

- **Real-time Block Tracking** -- Panel automatically follows your cursor, instantly displaying attributes when clicking or navigating to any block
- **Internal and Custom Attributes Separated** -- System fields (id, type, etc.) are read-only, while user-editable fields (name, alias, memo, bookmark, title, tags) are always visible and directly editable
- **Custom Attribute Management** -- Add, edit, or delete `custom-` prefixed attributes directly in the panel
- **Inline Editing** -- Click any editable value to edit in place, saves on blur
- **Optimistic Updates** -- UI responds immediately after editing, auto-rolls back on network errors
- **Visual Status Indicators** -- Each row shows saving / saved / failed status
- **Collapsible Groups** -- Internal and custom attributes can be independently collapsed, with state persisted across sessions

### Attribute Statistics

- **Document Custom Attribute Blocks** -- Lists all blocks in the current document containing custom attributes, with one-click jump to location
- **Notebook Attribute Statistics** -- Groups all custom attribute values by name, showing usage counts across the current notebook
- **Hover to Edit** -- Hover over any statistic value to quickly edit or delete it
- **Batch Operations** -- Select multiple attribute values to batch edit or batch delete, improving management efficiency
- **Block Jumping** -- Click any item in the document custom attribute blocks list to jump directly to its position in the editor

### Other Features

- **Multi-language** -- Supports Simplified Chinese and English out of the box
- **Settings** -- Optional attribute statistics logging for diagnostics

## Installation

1. Open **Settings** > **Bazaar** > **Plugins** in SiYuan
2. Search for "Property Manager" or "属性管家"
3. Click **Install** and enable the plugin

Or manually:
1. Download `package.zip` from [GitHub Releases](https://github.com/Wetoria/siyuan-property-manager/releases)
2. Extract to `data/plugins/siyuan-property-manager/` in your SiYuan workspace
3. Restart SiYuan, then enable the plugin in **Settings** > **Bazaar** > **Installed**

## Usage

### View and Edit Attributes

1. Click the plugin icon in the right sidebar to open the attribute panel
2. Click any block in the editor to display its attributes
3. **Edit attribute value**: Click the value text to enter edit mode, click elsewhere or press Enter to save
4. **Add custom attribute**: In the "Custom Attributes" section, fill in the attribute name (no need to add `custom-` prefix) and value in the bottom input row, press Enter or click confirm to add
5. **Delete custom attribute**: Hover over the row and click the **x** button to delete

### Use Attribute Statistics

1. Click the **Attribute Statistics** tab at the top of the panel
2. **Document Custom Attribute Blocks**: View all blocks with custom attributes in the current document, click to jump
3. **Notebook Attribute Statistics**:
   - View all custom attribute values and their usage counts in the current notebook
   - Hover over a value, click the edit icon to modify it (will batch update all blocks using that value)
   - Click the delete icon to remove it (will remove from all blocks using that value)
   - Select multiple values, then click batch edit or batch delete for bulk operations

## License

[MIT](LICENSE)
