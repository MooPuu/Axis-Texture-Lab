// Tauri v2 to Electron API bridge
(function() {
  function getInvoke() {
    if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
      return window.__TAURI__.core.invoke;
    }
    if (window.__TAURI__ && window.__TAURI__.invoke) {
      return window.__TAURI__.invoke;
    }
    return null;
  }

  async function invokeCommand(cmd, args) {
    const inv = getInvoke();
    if (inv) {
      return await inv(cmd, args);
    }
    console.warn('Tauri invoke not found for', cmd);
    return null;
  }

  window.electronAPI = {
    getPathForFile: (file) => {
      try {
        return file.path || file.name || '';
      } catch {
        return '';
      }
    },
    dialog: {
      openFile: async (options = {}) => {
        const filters = (options.filters || []).map(f => ({
          name: f.name,
          extensions: f.extensions
        }));
        const res = await invokeCommand('dialog_open_file', {
          options: {
            title: options.title || null,
            default_path: options.defaultPath || null,
            filters: filters.length ? filters : null,
            properties: options.properties || null
          }
        });
        return res || { canceled: true, filePaths: [] };
      },
      openDirectory: async (options = {}) => {
        const res = await invokeCommand('dialog_open_directory', {
          options: {
            title: options.title || null,
            default_path: options.defaultPath || null
          }
        });
        return res || { canceled: true, filePaths: [] };
      },
      saveFile: async (options = {}) => {
        const filters = (options.filters || []).map(f => ({
          name: f.name,
          extensions: f.extensions
        }));
        const res = await invokeCommand('dialog_save_file', {
          options: {
            title: options.title || null,
            default_path: options.defaultPath || null,
            filters: filters.length ? filters : null
          }
        });
        return res || { canceled: true, filePath: null };
      }
    },
    fs: {
      writeFile: async (filePath, data) => {
        let bytes;
        if (data instanceof ArrayBuffer) {
          bytes = Array.from(new Uint8Array(data));
        } else if (ArrayBuffer.isView(data)) {
          bytes = Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        } else if (Array.isArray(data)) {
          bytes = data;
        } else if (typeof data === 'string') {
          bytes = Array.from(new TextEncoder().encode(data));
        } else {
          bytes = Array.from(new Uint8Array(data));
        }
        const res = await invokeCommand('fs_write_file', { path: filePath, data: bytes });
        if (res && res.error) {
          throw new Error(res.error);
        }
        return res || { success: true };
      },
      readFile: async (filePath) => {
        const bytes = await invokeCommand('fs_read_file', { path: filePath });
        if (bytes && Array.isArray(bytes)) {
          return new Uint8Array(bytes).buffer;
        }
        return new ArrayBuffer(0);
      }
    },
    app: {
      getVersion: async () => {
        const v = await invokeCommand('app_get_version');
        return v || '2.0.0';
      }
    }
  };
})();
