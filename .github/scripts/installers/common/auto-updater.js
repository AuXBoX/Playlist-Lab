#!/usr/bin/env node
/**
 * Playlist Lab Server - Auto Updater
 * Checks GitHub for new releases and handles automatic updates
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

const GITHUB_REPO = 'AuXBoX/Playlist-Lab';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

class AutoUpdater {
  constructor(options = {}) {
    this.currentVersion = options.currentVersion || '2.0.0';
    this.installDir = options.installDir || process.env.INSTALL_DIR || path.resolve(__dirname);
    this.dataDir = this.getDataDir();
    this.updateInfoFile = path.join(this.dataDir, 'update-info.json');
    this.onUpdateAvailable = options.onUpdateAvailable || (() => {});
    this.onUpdateDownloaded = options.onUpdateDownloaded || (() => {});
    this.onUpdateError = options.onUpdateError || (() => {});
    this.onUpdateProgress = options.onUpdateProgress || (() => {});
    
    this.log('Auto-updater initialized');
    this.log(`Current version: ${this.currentVersion}`);
    this.log(`Install directory: ${this.installDir}`);
  }

  getDataDir() {
    if (os.platform() === 'win32') {
      return path.join(process.env.APPDATA || os.homedir(), 'PlaylistLabServer');
    } else if (os.platform() === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'PlaylistLabServer');
    } else {
      return path.join(os.homedir(), '.local', 'share', 'PlaylistLabServer');
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [AutoUpdater] ${message}`;
    console.log(logMessage);
    
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.appendFileSync(path.join(this.dataDir, 'updater.log'), logMessage + '\n');
    } catch (err) {
      // Ignore logging errors
    }
  }

  /**
   * Check for updates from GitHub releases
   */
  async checkForUpdates() {
    this.log('Checking for updates...');
    
    try {
      const release = await this.fetchLatestRelease();
      
      if (!release) {
        this.log('No release information available');
        return null;
      }

      const latestVersion = release.tag_name.replace(/^v/, '');
      this.log(`Latest version: ${latestVersion}`);

      if (this.isNewerVersion(latestVersion, this.currentVersion)) {
        this.log(`Update available: ${latestVersion}`);
        
        const updateInfo = {
          version: latestVersion,
          releaseDate: release.published_at,
          releaseNotes: release.body,
          downloadUrl: this.getInstallerUrl(release),
          htmlUrl: release.html_url,
          checkedAt: new Date().toISOString()
        };

        this.saveUpdateInfo(updateInfo);
        this.onUpdateAvailable(updateInfo);
        
        return updateInfo;
      } else {
        this.log('Already on latest version');
        return null;
      }
    } catch (error) {
      this.log(`Error checking for updates: ${error.message}`);
      this.onUpdateError(error);
      return null;
    }
  }

  /**
   * Fetch latest release from GitHub API
   */
  fetchLatestRelease() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_REPO}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'Playlist-Lab-Auto-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const release = JSON.parse(data);
              resolve(release);
            } catch (err) {
              reject(new Error(`Failed to parse release data: ${err.message}`));
            }
          } else if (res.statusCode === 404) {
            resolve(null); // No releases yet
          } else {
            reject(new Error(`GitHub API returned ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Get installer download URL from release assets
   */
  getInstallerUrl(release) {
    if (!release.assets || release.assets.length === 0) {
      return null;
    }

    // Find Windows installer
    const windowsInstaller = release.assets.find(asset => 
      asset.name.includes('Setup') && asset.name.endsWith('.exe')
    );

    return windowsInstaller ? windowsInstaller.browser_download_url : null;
  }

  /**
   * Compare version strings (semver)
   */
  isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const l = latestParts[i] || 0;
      const c = currentParts[i] || 0;
      
      if (l > c) return true;
      if (l < c) return false;
    }

    return false;
  }

  /**
   * Download update installer
   */
  async downloadUpdate(updateInfo) {
    if (!updateInfo.downloadUrl) {
      throw new Error('No download URL available');
    }

    this.log(`Downloading update from: ${updateInfo.downloadUrl}`);
    
    const downloadPath = path.join(this.dataDir, `PlaylistLabServer-Setup-${updateInfo.version}.exe`);
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(downloadPath);
      let downloadedBytes = 0;
      let totalBytes = 0;

      const request = https.get(updateInfo.downloadUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          https.get(response.headers.location, (redirectResponse) => {
            totalBytes = parseInt(redirectResponse.headers['content-length'], 10);
            
            redirectResponse.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
              this.onUpdateProgress(progress, downloadedBytes, totalBytes);
            });

            redirectResponse.pipe(file);
          });
          return;
        }

        totalBytes = parseInt(response.headers['content-length'], 10);
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
          this.onUpdateProgress(progress, downloadedBytes, totalBytes);
        });

        response.pipe(file);
      });

      file.on('finish', () => {
        file.close();
        this.log(`Download complete: ${downloadPath}`);
        this.onUpdateDownloaded(downloadPath);
        resolve(downloadPath);
      });

      file.on('error', (err) => {
        fs.unlink(downloadPath, () => {});
        reject(err);
      });

      request.on('error', (err) => {
        fs.unlink(downloadPath, () => {});
        reject(err);
      });

      request.setTimeout(300000, () => { // 5 minute timeout
        request.destroy();
        fs.unlink(downloadPath, () => {});
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Install downloaded update
   */
  async installUpdate(installerPath) {
    this.log(`Installing update from: ${installerPath}`);

    if (!fs.existsSync(installerPath)) {
      throw new Error('Installer file not found');
    }

    return new Promise((resolve, reject) => {
      // Run installer with silent flag
      const installer = spawn(installerPath, ['/SILENT', '/CLOSEAPPLICATIONS', '/RESTARTAPPLICATIONS'], {
        detached: true,
        stdio: 'ignore'
      });

      installer.unref();

      // Give installer time to start
      setTimeout(() => {
        this.log('Installer launched, exiting application...');
        resolve();
      }, 2000);
    });
  }

  /**
   * Save update info to file
   */
  saveUpdateInfo(updateInfo) {
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.writeFileSync(this.updateInfoFile, JSON.stringify(updateInfo, null, 2));
    } catch (err) {
      this.log(`Failed to save update info: ${err.message}`);
    }
  }

  /**
   * Load saved update info
   */
  loadUpdateInfo() {
    try {
      if (fs.existsSync(this.updateInfoFile)) {
        const data = fs.readFileSync(this.updateInfoFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      this.log(`Failed to load update info: ${err.message}`);
    }
    return null;
  }

  /**
   * Clear saved update info
   */
  clearUpdateInfo() {
    try {
      if (fs.existsSync(this.updateInfoFile)) {
        fs.unlinkSync(this.updateInfoFile);
      }
    } catch (err) {
      this.log(`Failed to clear update info: ${err.message}`);
    }
  }

  /**
   * Start automatic update checking
   */
  startAutoCheck(interval = UPDATE_CHECK_INTERVAL) {
    this.log(`Starting automatic update checks (every ${interval / 1000 / 60 / 60} hours)`);
    
    // Check immediately
    this.checkForUpdates();
    
    // Then check periodically
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, interval);
  }

  /**
   * Stop automatic update checking
   */
  stopAutoCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.log('Stopped automatic update checks');
    }
  }
}

module.exports = AutoUpdater;
