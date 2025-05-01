let files = [];
// Variables to store search results
let searchResultFiles = [];

function showError(message) {
    const errorElement = document.getElementById('error');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function updateTextArea() {
    const content = files
        .map(file => `-- begin: ${file.path}\n${file.content}\n-- end: ${file.path}\n`)
        .join('\n');
    document.getElementById('content').value = content;
    
    // Update token count
    updateTokenCount(content);
}

async function updateTokenCount(text) {
    try {
        const result = await window.electronAPI.calculateTokens(text);
        const tokenCountElement = document.getElementById('tokenCount');
        tokenCountElement.textContent = `Approx. tokens: ${result.tokenCount.toLocaleString()}`;
        tokenCountElement.style.display = 'block';
    } catch (error) {
        console.error('Failed to calculate tokens:', error);
    }
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileName = document.createElement('span');
        fileName.textContent = file.path.split('/').pop();
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = () => {
            files.splice(index, 1);
            updateFileList();
            updateTextArea();
        };
        
        fileItem.appendChild(fileName);
        fileItem.appendChild(deleteButton);
        fileList.appendChild(fileItem);
    });
}

async function reloadFiles() {
    try {
        const updatedFiles = [];
        for (const file of files) {
            const result = await window.electronAPI.reloadFile(file.path);
            if (result.success) {
                updatedFiles.push({
                    path: result.path,
                    content: result.content
                });
            } else {
                showError(`Failed to reload ${file.path}: ${result.error}`);
            }
        }
        files = updatedFiles;
        updateFileList();
        updateTextArea();
    } catch (error) {
        showError('Failed to reload files');
    }
}

function clearAll() {
    if (confirm('Are you sure you want to clear all files? This action cannot be undone.')) {
        files = [];
        updateFileList();
        updateTextArea();
    }
}

// Modal functionality
const modal = document.getElementById('searchModal');
const browseBtn = document.createElement('button');
browseBtn.textContent = 'Browse...';
browseBtn.id = 'browseFolder';

function openModal() {
    // Reset the modal state
    resetModal();
    
    // Clear input fields (except excludeFolders which has default value)
    document.getElementById('baseFolder').value = '';
    document.getElementById('extensions').value = '';
    
    // Show the modal
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
}

// Function to display search results
function showSearchResults(files) {
    searchResultFiles = files;
    
    // Update file count
    document.getElementById('file-count').textContent = files.length;
    
    // Show file preview
    const filePreview = document.getElementById('file-preview');
    filePreview.innerHTML = '';
    
    // Show all files
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'preview-item';
        fileItem.textContent = file.path;
        filePreview.appendChild(fileItem);
    });
    
    // Show search results section
    document.getElementById('search-results').style.display = 'flex';
    // Hide search buttons
    document.getElementById('search-buttons').style.display = 'none';
}

// Function to add all files from search results
function addAllFilesFromSearch() {
    // Append new files to existing files array
    files = [...files, ...searchResultFiles];
    updateFileList();
    updateTextArea();
    
    // Show success message
    showError(`Successfully added ${searchResultFiles.length} files`);
    
    // Reset search results
    searchResultFiles = [];
    
    // Close modal
    closeModal();
}

// Function to reset the modal
function resetModal() {
    // Hide loading and results sections
    document.getElementById('loading').style.display = 'none';
    document.getElementById('search-results').style.display = 'none';
    
    // Show search buttons
    document.getElementById('search-buttons').style.display = 'flex';
    
    // Enable buttons
    document.getElementById('searchFiles').disabled = false;
    document.getElementById('cancelSearch').disabled = false;
    
    // Also ensure input fields are enabled
    document.getElementById('baseFolder').disabled = false;
    document.getElementById('extensions').disabled = false;
    document.getElementById('excludeFolders').disabled = false;
}

// Function to close modal with cleanup
function closeModalWithReset() {
    resetModal();
    closeModal();
}

// Search files functionality
async function searchFiles() {
    const baseFolder = document.getElementById('baseFolder').value.trim();
    if (!baseFolder) {
        showError('Please specify a base folder');
        return;
    }

    const extensionsInput = document.getElementById('extensions').value.trim();
    const excludeFoldersInput = document.getElementById('excludeFolders').value.trim();
    
    // Show loading indicator
    const loadingIndicator = document.getElementById('loading');
    const searchButton = document.getElementById('searchFiles');
    const cancelButton = document.getElementById('cancelSearch');
    
    loadingIndicator.style.display = 'flex';
    searchButton.disabled = true;
    cancelButton.disabled = true;

    try {
        const result = await window.electronAPI.searchFiles(baseFolder, extensionsInput, excludeFoldersInput);
        
        // Hide loading indicator
        loadingIndicator.style.display = 'none';
        
        if (result.success) {
            if (result.files.length === 0) {
                // Re-enable buttons
                searchButton.disabled = false;
                cancelButton.disabled = false;
                showError('No matching files found');
            } else {
                // Show the search results
                showSearchResults(result.files);
                
                // If there are errors, show them
                if (result.errors && result.errors.length > 0) {
                    showError(`Found ${result.files.length} files. Some files were skipped: ${result.errors.length} errors`);
                }
            }
        } else {
            // Re-enable buttons
            searchButton.disabled = false;
            cancelButton.disabled = false;
            showError(result.error);
        }
    } catch (error) {
        // Hide loading indicator and re-enable buttons
        loadingIndicator.style.display = 'none';
        searchButton.disabled = false;
        cancelButton.disabled = false;
        
        showError(`Error searching files: ${error.message}`);
    }
}

// Select directory for base folder
async function selectDirectory() {
    try {
        const result = await window.electronAPI.selectDirectory();
        if (result.success) {
            document.getElementById('baseFolder').value = result.path;
        }
    } catch (error) {
        showError('Failed to select directory');
    }
}

// Event listeners for existing buttons
document.getElementById('addFile').addEventListener('click', async () => {
    try {
        const result = await window.electronAPI.selectFile();
        if (result.success) {
            files.push({
                path: result.path,
                content: result.content
            });
            updateFileList();
            updateTextArea();
        } else {
            showError(result.error);
        }
    } catch (error) {
        showError(error.message);
    }
});

document.getElementById('copy').addEventListener('click', async () => {
    try {
        const content = document.getElementById('content').value;
        await navigator.clipboard.writeText(content);
        showError('Content copied to clipboard!');
    } catch (error) {
        showError('Failed to copy to clipboard');
    }
});

document.getElementById('reloadFiles').addEventListener('click', reloadFiles);
document.getElementById('clearAll').addEventListener('click', clearAll);

// Add new button to sidebar for opening modal
function createSearchFilesButton() {
    const buttonsDiv = document.querySelector('.buttons');
    const searchFilesBtn = document.getElementById('searchFilesBtn');
    
    // Add event listener
    searchFilesBtn.addEventListener('click', openModal);
}

// Create token count element
function createTokenCounter() {
    const mainContent = document.querySelector('.main-content');
    const tokenCountElement = document.createElement('div');
    tokenCountElement.id = 'tokenCount';
    tokenCountElement.className = 'token-count';
    tokenCountElement.textContent = 'Approx. tokens: 0';
    
    // Insert before the "Copy to Clipboard" button
    mainContent.insertBefore(tokenCountElement, document.getElementById('copy'));
}

// Set up modal event listeners
document.addEventListener('DOMContentLoaded', async () => {
    createSearchFilesButton();    
    
    // Display app version
    try {
        const version = await window.electronAPI.getAppVersion();
        document.getElementById('version').textContent = `v${version}`;
    } catch (error) {
        console.error('Failed to get app version:', error);
    }
    
    // Modal event listeners
    document.querySelector('.close').addEventListener('click', closeModalWithReset);
    document.getElementById('cancelSearch').addEventListener('click', closeModalWithReset);
    document.getElementById('searchFiles').addEventListener('click', searchFiles);
    
    // Add event listeners for confirmation buttons
    document.getElementById('addAllFiles').addEventListener('click', addAllFilesFromSearch);
    document.getElementById('cancelAddFiles').addEventListener('click', closeModalWithReset);
    
    // Add browse button next to base folder input
    const baseFolderInput = document.getElementById('baseFolder');
    const baseFolderParent = baseFolderInput.parentElement;
    
    // Create a container for the input and button
    const inputContainer = document.createElement('div');
    inputContainer.style.display = 'flex';
    inputContainer.style.gap = '8px';
    
    // Move input into container
    baseFolderInput.parentNode.removeChild(baseFolderInput);
    inputContainer.appendChild(baseFolderInput);
    
    // Add browse button
    browseBtn.style.flexShrink = '0';
    inputContainer.appendChild(browseBtn);
    
    // Add container to form group
    baseFolderParent.appendChild(inputContainer);
    
    // Add event listener for browse button
    browseBtn.addEventListener('click', selectDirectory);
    
    // We're removing the event listener that closes the modal when clicking outside
    // This was previously here:
    // window.addEventListener('click', (event) => {
    //     if (event.target === modal) {
    //         closeModalWithReset();
    //     }
    // });
});