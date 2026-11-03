// VS Code can reveal files edited by a WorkspaceEdit in the current editor group.
// Close only clean text tabs that appeared during this operation for targeted files.
function replacementTabsToClose(groups, originalTabs, originalUris, targetUris) {
  return groups.flatMap(group => group.tabs).filter(tab => {
    const uri = tab.input?.uri?.toString();
    return uri && targetUris.has(uri) && !originalUris.has(uri) && !originalTabs.has(tab) && !tab.isDirty;
  });
}
module.exports = { replacementTabsToClose };
