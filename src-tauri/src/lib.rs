use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilterOption {
    pub name: Option<String>,
    pub extensions: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct OpenFileOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub filters: Option<Vec<FilterOption>>,
    pub properties: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SaveFileOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub filters: Option<Vec<FilterOption>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenDialogResult {
    pub canceled: bool,
    #[serde(rename = "filePaths")]
    pub file_paths: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveDialogResult {
    pub canceled: bool,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FsResult {
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
fn dialog_open_file(options: Option<OpenFileOptions>) -> OpenDialogResult {
    let mut dialog = rfd::FileDialog::new();
    let opts = options.unwrap_or_default();

    if let Some(ref title) = opts.title {
        dialog = dialog.set_title(title);
    }
    if let Some(ref path) = opts.default_path {
        if !path.trim().is_empty() {
            dialog = dialog.set_directory(path);
        }
    }
    if let Some(filters) = opts.filters {
        for f in filters {
            let name = f.name.unwrap_or_else(|| "Files".to_string());
            if let Some(exts) = f.extensions {
                let valid_exts: Vec<&str> = exts
                    .iter()
                    .filter(|s| *s != "*" && !s.is_empty())
                    .map(|s| s.trim_start_matches('.'))
                    .collect();
                if !valid_exts.is_empty() {
                    dialog = dialog.add_filter(&name, &valid_exts);
                }
            }
        }
    }

    if let Some(files) = dialog.pick_files() {
        OpenDialogResult {
            canceled: false,
            file_paths: files.into_iter().map(|p| p.to_string_lossy().to_string()).collect(),
        }
    } else {
        OpenDialogResult {
            canceled: true,
            file_paths: vec![],
        }
    }
}

#[tauri::command]
fn dialog_open_directory(options: Option<OpenFileOptions>) -> OpenDialogResult {
    let mut dialog = rfd::FileDialog::new();
    let opts = options.unwrap_or_default();

    if let Some(ref title) = opts.title {
        dialog = dialog.set_title(title);
    }
    if let Some(ref path) = opts.default_path {
        if !path.trim().is_empty() {
            dialog = dialog.set_directory(path);
        }
    }

    if let Some(dir) = dialog.pick_folder() {
        OpenDialogResult {
            canceled: false,
            file_paths: vec![dir.to_string_lossy().to_string()],
        }
    } else {
        OpenDialogResult {
            canceled: true,
            file_paths: vec![],
        }
    }
}

#[tauri::command]
fn dialog_save_file(options: Option<SaveFileOptions>) -> SaveDialogResult {
    let mut dialog = rfd::FileDialog::new();
    let opts = options.unwrap_or_default();

    if let Some(ref title) = opts.title {
        dialog = dialog.set_title(title);
    }
    if let Some(ref path) = opts.default_path {
        let p = PathBuf::from(path);
        if let Some(parent) = p.parent() {
            if !parent.as_os_str().is_empty() {
                dialog = dialog.set_directory(parent);
            }
        }
        if let Some(name) = p.file_name() {
            dialog = dialog.set_file_name(name.to_string_lossy().to_string());
        }
    }
    if let Some(filters) = opts.filters {
        for f in filters {
            let name = f.name.unwrap_or_else(|| "Files".to_string());
            if let Some(exts) = f.extensions {
                let valid_exts: Vec<&str> = exts
                    .iter()
                    .filter(|s| *s != "*" && !s.is_empty())
                    .map(|s| s.trim_start_matches('.'))
                    .collect();
                if !valid_exts.is_empty() {
                    dialog = dialog.add_filter(&name, &valid_exts);
                }
            }
        }
    }

    if let Some(file) = dialog.save_file() {
        SaveDialogResult {
            canceled: false,
            file_path: Some(file.to_string_lossy().to_string()),
        }
    } else {
        SaveDialogResult {
            canceled: true,
            file_path: None,
        }
    }
}

#[tauri::command]
fn fs_write_file(path: String, data: Vec<u8>) -> FsResult {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        let _ = fs::create_dir_all(parent);
    }
    match fs::write(&p, &data) {
        Ok(_) => FsResult { success: true, error: None },
        Err(e) => FsResult { success: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
fn fs_read_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn app_get_version() -> String {
    "2.0.0".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            dialog_open_file,
            dialog_open_directory,
            dialog_save_file,
            fs_write_file,
            fs_read_file,
            app_get_version
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
