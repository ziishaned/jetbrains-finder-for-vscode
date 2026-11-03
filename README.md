# JetBrains Replace in Files for VS Code

Find and replace in a workspace in a JetBrains-inspired view with live results and a preview of the selected match. On recent versions of VS Code, the view can open as a floating modal editor over your code.

![Replace in Files screenshot](https://i.imgur.com/PiuCynm.png)

## Enable the modal

VS Code controls modal placement. Open **Preferences: Open User Settings (JSON)** and set:

```json
"workbench.editor.useModal": "all"
```

This is a VS Code-wide preference: **other editors may also open as modals**. The extension does not change this setting for you. With `"some"` or `"off"`, Replace in Files opens as an editor tab. The modal editor was introduced experimentally in VS Code 1.110; this integration should be used with a recent VS Code release.

## Use

This release supports VS Code on Apple Silicon Macs. Open a folder or workspace, then press **Cmd+Shift+R**. You can also run **JetBrains Replace: Replace in Files** from the Command Palette. A single-line editor selection is used as the initial query.

- Toggle case sensitivity, whole-word matching, and regular expressions beside the search field.
- Search the whole workspace, a workspace folder, or a selected directory.
- Use the arrow keys to select a result, Enter to open it, and Escape to close the view. Clicking previews; double-clicking opens.
- Enter replacement text and use **Replace** for the selected match or **Replace All** for all results. An empty replacement removes the matches. Regular expressions support capture references such as `$1` and `$<name>`.
- **Open in Search View** transfers the query and search options to VS Code's built-in search.

## Install and develop

Run `npm install`, then `npm run package` and install the generated `.vsix` using **Extensions: Install from VSIX...** in VS Code. Alternatively open the project in VS Code and press F5 to run an Extension Development Host. Run `npm test` for the search tests.

The default shortcut can be changed in Keyboard Shortcuts if it conflicts with another command; the built-in search remains available from the Search view and Command Palette.

## Current limitations

The extension uses ripgrep to search files on disk, respects ignore files and boolean `search.exclude` entries, and limits results to the first 1,000 matches. Replace All is disabled when that limit is reached; narrow the search first. Replacements are applied as VS Code workspace edits and can be undone. Save unsaved changes before replacing; modified files are saved after replacement. Files changed since the search must be searched again. Regular-expression replacements require a pattern supported by both ripgrep and JavaScript. Unsaved edits are shown in the preview but are not included in search results until saved. Search supports file-based workspaces on a compatible extension host; virtual workspaces are not supported. Directory scopes are approximations of JetBrains scopes; JetBrains modules and named scopes are not available. Open in Search View transfers the query and options, but not the selected workspace folder or directory.
