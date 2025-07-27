const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { glob } = require('glob');

// Store for remembering last visited folder
let lastVisitedFolder = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

app.disableHardwareAcceleration(); 

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

async function isTextFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    
    if (stats.size > 1024 * 1024) {
      return false;
    }

    const buffer = await fs.readFile(filePath);
    
    if (buffer.includes(0)) {
      return false;
    }

    let nonPrintable = 0;
    const sampleSize = Math.min(buffer.length, 1024);
    
    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];
      if ((byte < 32 || byte > 126) && ![9, 10, 13].includes(byte)) {
        nonPrintable++;
      }
    }

    return (nonPrintable / sampleSize) < 0.3;
  } catch (error) {
    return false;
  }
}

async function readTextFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

ipcMain.handle('reloadFile', async (_, filePath) => {
  if (await isTextFile(filePath)) {
    const fileContent = await readTextFile(filePath);
    if (fileContent.success) {
      return {
        success: true,
        path: filePath,
        content: fileContent.content
      };
    } else {
      return { success: false, error: fileContent.error };
    }
  } else {
    return { success: false, error: 'Not a text file' };
  }
});

ipcMain.handle('select-file', async () => {
  const dialogOptions = {
    properties: ['openFile']
  };
  
  // Only set defaultPath if we have a valid folder
  if (lastVisitedFolder) {
    dialogOptions.defaultPath = lastVisitedFolder;
  }
  
  const result = await dialog.showOpenDialog(dialogOptions);
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    
    // Remember the folder for next time
    lastVisitedFolder = path.dirname(filePath);
    
    if (await isTextFile(filePath)) {
      const fileContent = await readTextFile(filePath);
      if (fileContent.success) {
        return {
          success: true,
          path: filePath,
          content: fileContent.content
        };
      } else {
        return { success: false, error: fileContent.error };
      }
    } else {
      return { success: false, error: 'Not a text file' };
    }
  }
  return { success: false, error: 'No file selected' };
});

// Updated directory selection handler
ipcMain.handle('select-directory', async () => {
  const dialogOptions = {
    properties: ['openDirectory']
  };
  
  // Only set defaultPath if we have a valid folder
  if (lastVisitedFolder) {
    dialogOptions.defaultPath = lastVisitedFolder;
  }
  
  const result = await dialog.showOpenDialog(dialogOptions);
  
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    // Remember this folder for next time
    lastVisitedFolder = selectedPath;
    
    return {
      success: true,
      path: selectedPath
    };
  }
  return { success: false, error: 'No directory selected' };
});

// Function to estimate token count (very rough estimate)
function estimateTokenCount(text) {
  // A very rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Add recursive file search functionality
ipcMain.handle('search-files', async (_, baseFolder, extensionsString, excludeFoldersString) => {
  // Remember this folder for next time
  lastVisitedFolder = baseFolder;
  
  // Parse the comma-separated strings into arrays
  const extensions = extensionsString.split(',').map(ext => ext.trim()).filter(ext => ext);
  const excludeFolders = excludeFoldersString.split(',').map(folder => folder.trim()).filter(folder => folder);

  try {
    // Validate base folder exists
    try {
      const stats = await fs.stat(baseFolder);
      if (!stats.isDirectory()) {
        return { success: false, error: 'Not a valid directory' };
      }
    } catch (error) {
      return { success: false, error: 'Directory not found' };
    }

    // Use the glob pattern to find files
    let patterns = [];
    if (extensions && extensions.length > 0) {
      // Create patterns for each extension
      patterns = extensions.map(ext => 
        ext.startsWith('.') ? `**/*${ext}` : `**/*.${ext}`
      );
    } else {
      // If no extensions specified, get all files
      patterns = ['**/*'];
    }

    // Set up ignore patterns for excluded folders
    const ignorePatterns = [
      '**/node_modules/**',  // Always ignore node_modules
      '**/.git/**'           // Always ignore .git
    ];

    // Add user-specified exclude folders
    if (excludeFolders && excludeFolders.length > 0) {
      excludeFolders.forEach(folder => {
        if (folder && folder.trim() !== '') {
          ignorePatterns.push(`**/${folder.trim()}/**`);
        }
      });
    }

    // Collect all matching files
    let allFiles = [];
    
    for (const pattern of patterns) {
      const matchedFiles = await glob(pattern, {
        cwd: baseFolder,
        ignore: ignorePatterns,
        absolute: true,
        nodir: true
      });
      
      allFiles = [...allFiles, ...matchedFiles];
    }

    // Remove duplicates
    allFiles = [...new Set(allFiles)];

    // Limit number of files to prevent overloading - increased to 200
    const MAX_FILES = 200;
    if (allFiles.length > MAX_FILES) {
      return {
        success: false,
        error: `Found ${allFiles.length} files. Please narrow your search criteria (max: ${MAX_FILES} files).`
      };
    }

    // Process files
    const results = [];
    const errors = [];

    for (const filePath of allFiles) {
      try {
        if (await isTextFile(filePath)) {
          const fileContent = await readTextFile(filePath);
          if (fileContent.success) {
            results.push({
              path: filePath,
              content: fileContent.content
            });
          } else {
            errors.push(`${path.basename(filePath)}: ${fileContent.error}`);
          }
        }
      } catch (error) {
        errors.push(`${path.basename(filePath)}: ${error.message}`);
      }
    }

    // Return results
    return {
      success: true,
      files: results,
      errors: errors.length > 0 ? errors : null
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Add token count calculation
ipcMain.handle('calculate-tokens', async (_, text) => {
  const tokenCount = estimateTokenCount(text);
  return { tokenCount };
});

// Add handler to get app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Add handlers for persistent storage
ipcMain.handle('get-last-folder', () => {
  return lastVisitedFolder;
});

ipcMain.handle('set-last-folder', (_, folderPath) => {
  lastVisitedFolder = folderPath;
});