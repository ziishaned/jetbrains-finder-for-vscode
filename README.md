# vscode-jetbrains-finder

Search a workspace in a JetBrains-inspired view with live results and a preview of the selected match. On recent versions of VS Code, the view can open as a floating modal editor over your code.

<img width="1604" height="1192" alt="" src="https://i.imgur.com/xfAVo0q.png" />

## Enable the modal

VS Code controls modal placement. Open **Preferences: Open User Settings (JSON)** and set:

```json
"workbench.editor.useModal": "all"
```

This is a VS Code-wide preference: **other editors may also open as modals**. The extension does not change this setting for you. With `"some"` or `"off"`, Find in Files opens as an editor tab. The modal editor was introduced experimentally in VS Code 1.110; this integration should be used with a recent VS Code release.

## Use

Open a folder or workspace, then press **Cmd+Shift+F** on macOS or **Ctrl+Shift+F** on Windows/Linux. You can also run **JetBrains Finder: Find in Files** from the Command Palette. A single-line editor selection is used as the initial query.

- Toggle case sensitivity, whole-word matching, and regular expressions beside the search field.
- Search the whole workspace, a workspace folder, or a directory relative to each workspace folder.
- Use the arrow keys to select a result, Enter to open it, and Escape to close the view. Clicking previews; double-clicking opens.
- **Open in Search View** transfers the query and search options to VS Code's built-in search.

## Install and develop

Run `npm install`, then `npm run package` and install the generated `.vsix` using **Extensions: Install from VSIX...** in VS Code. Alternatively open the project in VS Code and press F5 to run an Extension Development Host. Run `npm test` for the search tests.

The default shortcut replaces VS Code's built-in Find in Files shortcut while this extension is enabled. You can change it in Keyboard Shortcuts; the built-in search remains available from the Search view and Command Palette.

## Current limitations

The extension uses ripgrep to search files on disk, respects ignore files and boolean `search.exclude` entries, and limits results to the first 1,000 matches. Unsaved edits are shown in the preview but are not included in search results until saved. Search supports file-based workspaces on the local or remote extension host; virtual workspaces are not supported. Directory scopes are approximations of JetBrains scopes; JetBrains modules and named scopes are not available. Open in Search View transfers the query and options, but not the selected workspace folder or directory.
