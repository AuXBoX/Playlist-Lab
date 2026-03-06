/**
 * Tray Icon Manager Tests
 * 
 * Tests for the TrayIconManager class.
 */

import { TrayIconManager, TrayIconState } from '../tray-manager';
import { ServerProcessManager, ServerState } from '../server-manager';

// Mock Electron modules
jest.mock('electron', () => ({
  Tray: jest.fn().mockImplementation(() => ({
    setImage: jest.fn(),
    setToolTip: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn()
  })),
  Menu: {
    buildFromTemplate: jest.fn().mockReturnValue({})
  },
  nativeImage: {
    createFromPath: jest.fn().mockReturnValue({
      setTemplateImage: jest.fn()
    }),
    createEmpty: jest.fn().mockReturnValue({})
  },
  shell: {
    openExternal: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock platform adapter
jest.mock('../platform', () => ({
  getPlatformAdapter: jest.fn().mockReturnValue({
    getPlatform: jest.fn().mockReturnValue('windows'),
    openLogFolder: jest.fn()
  })
}));

describe('TrayIconManager', () => {
  let serverManager: any;
  
  beforeEach(() => {
    // Reset singleton
    TrayIconManager.resetInstance();
    
    // Create mock server manager
    serverManager = {
      getServerInfo: jest.fn().mockReturnValue({
        state: ServerState.STOPPED,
        mode: 'standalone',
        url: 'http://localhost:3000',
        port: 3000,
        uptime: 0,
        lastError: null,
        version: '1.0.0'
      }),
      getServerUrl: jest.fn().mockReturnValue('http://localhost:3000'),
      onStateChange: jest.fn(),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      restart: jest.fn().mockResolvedValue(undefined)
    } as any;
  });
  
  afterEach(() => {
    TrayIconManager.resetInstance();
  });
  
  describe('Singleton Pattern', () => {
    it('should create a singleton instance', () => {
      const instance1 = TrayIconManager.getInstance(serverManager);
      const instance2 = TrayIconManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should throw error if getInstance called without serverManager on first call', () => {
      expect(() => {
        TrayIconManager.getInstance();
      }).toThrow('ServerProcessManager required for first initialization');
    });
    
    it('should reset instance', () => {
      const instance1 = TrayIconManager.getInstance(serverManager);
      TrayIconManager.resetInstance();
      const instance2 = TrayIconManager.getInstance(serverManager);
      
      expect(instance1).not.toBe(instance2);
    });
  });
  
  describe('Initialization', () => {
    it('should initialize tray icon', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      
      expect(trayManager.isInitialized()).toBe(false);
      
      trayManager.initialize();
      
      expect(trayManager.isInitialized()).toBe(true);
    });
    
    it('should subscribe to server state changes', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      expect(serverManager.onStateChange).toHaveBeenCalled();
    });
    
    it('should not initialize twice', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      trayManager.initialize();
      trayManager.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('Tray icon already initialized');
      consoleSpy.mockRestore();
    });
  });
  
  describe('State Management', () => {
    it('should start with STOPPED state', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      
      expect(trayManager.getState()).toBe(TrayIconState.STOPPED);
    });
    
    it('should update icon when state changes', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      trayManager.updateIcon(TrayIconState.RUNNING);
      
      expect(trayManager.getState()).toBe(TrayIconState.RUNNING);
    });
    
    it('should update icon to RUNNING state', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      trayManager.updateIcon(TrayIconState.RUNNING);
      
      expect(trayManager.getState()).toBe(TrayIconState.RUNNING);
    });
    
    it('should update icon to STARTING state', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      trayManager.updateIcon(TrayIconState.STARTING);
      
      expect(trayManager.getState()).toBe(TrayIconState.STARTING);
    });
    
    it('should update icon to ERROR state', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      trayManager.updateIcon(TrayIconState.ERROR);
      
      expect(trayManager.getState()).toBe(TrayIconState.ERROR);
    });
    
    it('should update icon to STOPPED state', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      trayManager.updateIcon(TrayIconState.STOPPED);
      
      expect(trayManager.getState()).toBe(TrayIconState.STOPPED);
    });
    
    it('should handle state changes from server manager', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      // Get the state change callback
      const stateChangeCallback = serverManager.onStateChange.mock.calls[0][0];
      
      // Simulate server state change to RUNNING
      stateChangeCallback(ServerState.RUNNING);
      
      expect(trayManager.getState()).toBe(TrayIconState.RUNNING);
    });
    
    it('should map server states to tray states correctly', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      const stateChangeCallback = serverManager.onStateChange.mock.calls[0][0];
      
      // Test STOPPED -> STOPPED
      stateChangeCallback(ServerState.STOPPED);
      expect(trayManager.getState()).toBe(TrayIconState.STOPPED);
      
      // Test STARTING -> STARTING
      stateChangeCallback(ServerState.STARTING);
      expect(trayManager.getState()).toBe(TrayIconState.STARTING);
      
      // Test RUNNING -> RUNNING
      stateChangeCallback(ServerState.RUNNING);
      expect(trayManager.getState()).toBe(TrayIconState.RUNNING);
      
      // Test ERROR -> ERROR
      stateChangeCallback(ServerState.ERROR);
      expect(trayManager.getState()).toBe(TrayIconState.ERROR);
    });
    
    it('should update context menu when icon state changes', () => {
      const { Menu } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      // Clear previous calls
      Menu.buildFromTemplate.mockClear();
      
      // Update icon state
      trayManager.updateIcon(TrayIconState.RUNNING);
      
      // Context menu should be rebuilt
      expect(Menu.buildFromTemplate).toHaveBeenCalled();
    });
    
    it('should not update icon if tray is not initialized', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const trayManager = TrayIconManager.getInstance(serverManager);
      
      // Don't initialize
      trayManager.updateIcon(TrayIconState.RUNNING);
      
      expect(consoleSpy).toHaveBeenCalledWith('Cannot update icon: tray not initialized');
      consoleSpy.mockRestore();
    });
  });
  
  describe('Context Menu', () => {
    it('should update context menu', () => {
      const { Menu } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      trayManager.updateContextMenu();
      
      expect(Menu.buildFromTemplate).toHaveBeenCalled();
    });
    
    it('should enable "Open Web Interface" when server is running', () => {
      const { Menu } = require('electron');
      
      // Reset and create new instance with running server
      TrayIconManager.resetInstance();
      
      // Create a fresh server manager mock for this test
      const runningServerManager = {
        getServerInfo: jest.fn().mockReturnValue({
          state: ServerState.RUNNING,
          mode: 'standalone',
          url: 'http://localhost:3000',
          port: 3000,
          uptime: 100,
          lastError: null,
          version: '1.0.0'
        }),
        getServerUrl: jest.fn().mockReturnValue('http://localhost:3000'),
        onStateChange: jest.fn(),
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        restart: jest.fn().mockResolvedValue(undefined)
      };
      
      const trayManager = TrayIconManager.getInstance(runningServerManager);
      trayManager.initialize();
      
      // Verify the server info is correct
      const serverInfo = runningServerManager.getServerInfo();
      expect(serverInfo.state).toBe(ServerState.RUNNING);
      
      trayManager.updateContextMenu();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[Menu.buildFromTemplate.mock.calls.length - 1][0];
      const openWebItem = menuTemplate.find((item: any) => item.label === 'Open Web Interface');
      
      expect(openWebItem).toBeDefined();
      expect(openWebItem.enabled).toBe(true);
    });
    
    it('should disable "Open Web Interface" when server is stopped', () => {
      const { Menu } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      trayManager.updateContextMenu();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];
      const openWebItem = menuTemplate.find((item: any) => item.label === 'Open Web Interface');
      
      expect(openWebItem).toBeDefined();
      expect(openWebItem.enabled).toBe(false);
    });
    
    it('should show "Start Server" when server is stopped', () => {
      const { Menu } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      trayManager.updateContextMenu();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0][0];
      const startItem = menuTemplate.find((item: any) => item.label === 'Start Server');
      
      expect(startItem).toBeDefined();
    });
    
    it('should show "Stop Server" and "Restart Server" when server is running', () => {
      const { Menu } = require('electron');
      
      // Reset and create new instance with running server
      TrayIconManager.resetInstance();
      
      // Create a fresh server manager mock for this test
      const runningServerManager = {
        getServerInfo: jest.fn().mockReturnValue({
          state: ServerState.RUNNING,
          mode: 'standalone',
          url: 'http://localhost:3000',
          port: 3000,
          uptime: 100,
          lastError: null,
          version: '1.0.0'
        }),
        getServerUrl: jest.fn().mockReturnValue('http://localhost:3000'),
        onStateChange: jest.fn(),
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        restart: jest.fn().mockResolvedValue(undefined)
      };
      
      const trayManager = TrayIconManager.getInstance(runningServerManager);
      trayManager.initialize();
      
      // Verify the server info is correct
      const serverInfo = runningServerManager.getServerInfo();
      expect(serverInfo.state).toBe(ServerState.RUNNING);
      
      trayManager.updateContextMenu();
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[Menu.buildFromTemplate.mock.calls.length - 1][0];
      const stopItem = menuTemplate.find((item: any) => item.label === 'Stop Server');
      const restartItem = menuTemplate.find((item: any) => item.label === 'Restart Server');
      
      expect(stopItem).toBeDefined();
      expect(restartItem).toBeDefined();
    });
  });
  
  describe('Tooltip', () => {
    it('should update tooltip', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      const mockTray = Tray.mock.results[0].value;
      
      trayManager.updateTooltip('Test tooltip');
      
      expect(mockTray.setToolTip).toHaveBeenCalledWith('Test tooltip');
    });
    
    it('should show stopped state in tooltip', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      const mockTray = Tray.mock.results[0].value;
      
      trayManager.updateIcon(TrayIconState.STOPPED);
      
      const tooltipCall = mockTray.setToolTip.mock.calls[mockTray.setToolTip.mock.calls.length - 1][0];
      expect(tooltipCall).toContain('Stopped');
    });
    
    it('should show starting state in tooltip', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      const mockTray = Tray.mock.results[0].value;
      
      trayManager.updateIcon(TrayIconState.STARTING);
      
      const tooltipCall = mockTray.setToolTip.mock.calls[mockTray.setToolTip.mock.calls.length - 1][0];
      expect(tooltipCall).toContain('Starting');
    });
    
    it('should show running state with URL in tooltip', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      
      // Mock server as running
      serverManager.getServerInfo.mockReturnValue({
        state: ServerState.RUNNING,
        mode: 'standalone',
        url: 'http://localhost:3000',
        port: 3000,
        uptime: 120,
        lastError: null,
        version: '1.0.0'
      });
      
      trayManager.initialize();
      trayManager.updateIcon(TrayIconState.RUNNING);
      
      const mockTray = Tray.mock.results[0].value;
      const tooltipCall = mockTray.setToolTip.mock.calls[mockTray.setToolTip.mock.calls.length - 1][0];
      
      expect(tooltipCall).toContain('Running');
      expect(tooltipCall).toContain('http://localhost:3000');
    });
    
    it('should show error state with error message in tooltip', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      
      // Mock server with error
      serverManager.getServerInfo.mockReturnValue({
        state: ServerState.ERROR,
        mode: 'standalone',
        url: 'http://localhost:3000',
        port: 3000,
        uptime: 0,
        lastError: 'Port 3000 is already in use',
        version: '1.0.0'
      });
      
      trayManager.initialize();
      trayManager.updateIcon(TrayIconState.ERROR);
      
      const mockTray = Tray.mock.results[0].value;
      const tooltipCall = mockTray.setToolTip.mock.calls[mockTray.setToolTip.mock.calls.length - 1][0];
      
      expect(tooltipCall).toContain('Error');
      expect(tooltipCall).toContain('Port 3000 is already in use');
    });
    
    it('should truncate long error messages in tooltip', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      
      const longError = 'A'.repeat(150);
      
      // Mock server with long error
      serverManager.getServerInfo.mockReturnValue({
        state: ServerState.ERROR,
        mode: 'standalone',
        url: 'http://localhost:3000',
        port: 3000,
        uptime: 0,
        lastError: longError,
        version: '1.0.0'
      });
      
      trayManager.initialize();
      trayManager.updateIcon(TrayIconState.ERROR);
      
      const mockTray = Tray.mock.results[0].value;
      const tooltipCall = mockTray.setToolTip.mock.calls[mockTray.setToolTip.mock.calls.length - 1][0];
      
      expect(tooltipCall).toContain('Error');
      expect(tooltipCall.length).toBeLessThan(longError.length + 50);
      expect(tooltipCall).toContain('...');
    });
    
    it('should show installation mode in stopped tooltip', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      
      // Mock server with service mode
      serverManager.getServerInfo.mockReturnValue({
        state: ServerState.STOPPED,
        mode: 'service',
        url: 'http://localhost:3000',
        port: 3000,
        uptime: 0,
        lastError: null,
        version: '1.0.0'
      });
      
      trayManager.initialize();
      trayManager.updateIcon(TrayIconState.STOPPED);
      
      const mockTray = Tray.mock.results[0].value;
      const tooltipCall = mockTray.setToolTip.mock.calls[mockTray.setToolTip.mock.calls.length - 1][0];
      
      expect(tooltipCall).toContain('Stopped');
      expect(tooltipCall).toContain('System Service');
    });
    
    it('should show uptime in running tooltip', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      
      // Mock server running for 2 hours
      serverManager.getServerInfo.mockReturnValue({
        state: ServerState.RUNNING,
        mode: 'standalone',
        url: 'http://localhost:3000',
        port: 3000,
        uptime: 7200, // 2 hours
        lastError: null,
        version: '1.0.0'
      });
      
      trayManager.initialize();
      trayManager.updateIcon(TrayIconState.RUNNING);
      
      const mockTray = Tray.mock.results[0].value;
      const tooltipCall = mockTray.setToolTip.mock.calls[mockTray.setToolTip.mock.calls.length - 1][0];
      
      expect(tooltipCall).toContain('Running');
      expect(tooltipCall).toContain('Uptime');
    });
    
    it('should refresh tooltip without changing state', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      const mockTray = Tray.mock.results[0].value;
      const initialCallCount = mockTray.setToolTip.mock.calls.length;
      
      trayManager.refreshTooltip();
      
      expect(mockTray.setToolTip.mock.calls.length).toBe(initialCallCount + 1);
    });
    
    it('should handle missing error message gracefully', () => {
      const { Tray } = require('electron');
      const trayManager = TrayIconManager.getInstance(serverManager);
      
      // Mock server with error but no error message
      serverManager.getServerInfo.mockReturnValue({
        state: ServerState.ERROR,
        mode: 'standalone',
        url: 'http://localhost:3000',
        port: 3000,
        uptime: 0,
        lastError: null,
        version: '1.0.0'
      });
      
      trayManager.initialize();
      trayManager.updateIcon(TrayIconState.ERROR);
      
      const mockTray = Tray.mock.results[0].value;
      const tooltipCall = mockTray.setToolTip.mock.calls[mockTray.setToolTip.mock.calls.length - 1][0];
      
      expect(tooltipCall).toContain('Error');
      expect(tooltipCall).toContain('Unknown error');
    });
  });
  
  describe('Cleanup', () => {
    it('should destroy tray icon', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      expect(trayManager.isInitialized()).toBe(true);
      
      trayManager.destroy();
      
      expect(trayManager.isInitialized()).toBe(false);
    });
    
    it('should be safe to destroy multiple times', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      trayManager.initialize();
      
      trayManager.destroy();
      trayManager.destroy();
      
      expect(trayManager.isInitialized()).toBe(false);
    });
  });
  
  describe('Window Manager Integration', () => {
    it('should set window manager', () => {
      const trayManager = TrayIconManager.getInstance(serverManager);
      const mockWindowManager = {
        show: jest.fn(),
        toggle: jest.fn()
      };
      
      trayManager.setWindowManager(mockWindowManager);
      trayManager.toggleWindow();
      
      expect(mockWindowManager.toggle).toHaveBeenCalled();
    });
  });
  
  describe('Event Handling', () => {
    describe('Double-Click Event (Windows/Linux)', () => {
      it('should set up double-click handler on Windows', () => {
        const { Tray } = require('electron');
        const { getPlatformAdapter } = require('../platform');
        
        // Mock Windows platform
        getPlatformAdapter.mockReturnValue({
          getPlatform: jest.fn().mockReturnValue('windows'),
          openLogFolder: jest.fn()
        });
        
        const trayManager = TrayIconManager.getInstance(serverManager);
        trayManager.initialize();
        
        const mockTray = Tray.mock.results[0].value;
        
        // Verify double-click handler was registered
        expect(mockTray.on).toHaveBeenCalledWith('double-click', expect.any(Function));
      });
      
      it('should set up double-click handler on Linux', () => {
        const { Tray } = require('electron');
        const { getPlatformAdapter } = require('../platform');
        
        // Mock Linux platform
        getPlatformAdapter.mockReturnValue({
          getPlatform: jest.fn().mockReturnValue('linux'),
          openLogFolder: jest.fn()
        });
        
        TrayIconManager.resetInstance();
        const trayManager = TrayIconManager.getInstance(serverManager);
        trayManager.initialize();
        
        const mockTray = Tray.mock.results[0].value;
        
        // Verify double-click handler was registered
        expect(mockTray.on).toHaveBeenCalledWith('double-click', expect.any(Function));
      });
      
      it('should toggle window on double-click (Windows)', () => {
        const { Tray } = require('electron');
        const { getPlatformAdapter } = require('../platform');
        
        // Mock Windows platform
        getPlatformAdapter.mockReturnValue({
          getPlatform: jest.fn().mockReturnValue('windows'),
          openLogFolder: jest.fn()
        });
        
        TrayIconManager.resetInstance();
        const trayManager = TrayIconManager.getInstance(serverManager);
        
        const mockWindowManager = {
          show: jest.fn(),
          toggle: jest.fn()
        };
        trayManager.setWindowManager(mockWindowManager);
        
        trayManager.initialize();
        
        const mockTray = Tray.mock.results[0].value;
        
        // Get the double-click handler
        const doubleClickHandler = mockTray.on.mock.calls.find(
          (call: any) => call[0] === 'double-click'
        )?.[1];
        
        expect(doubleClickHandler).toBeDefined();
        
        // Simulate double-click
        doubleClickHandler();
        
        // Verify window was toggled
        expect(mockWindowManager.toggle).toHaveBeenCalled();
      });
      
      it('should toggle window on double-click (Linux)', () => {
        const { Tray } = require('electron');
        const { getPlatformAdapter } = require('../platform');
        
        // Mock Linux platform
        getPlatformAdapter.mockReturnValue({
          getPlatform: jest.fn().mockReturnValue('linux'),
          openLogFolder: jest.fn()
        });
        
        TrayIconManager.resetInstance();
        const trayManager = TrayIconManager.getInstance(serverManager);
        
        const mockWindowManager = {
          show: jest.fn(),
          toggle: jest.fn()
        };
        trayManager.setWindowManager(mockWindowManager);
        
        trayManager.initialize();
        
        const mockTray = Tray.mock.results[0].value;
        
        // Get the double-click handler
        const doubleClickHandler = mockTray.on.mock.calls.find(
          (call: any) => call[0] === 'double-click'
        )?.[1];
        
        expect(doubleClickHandler).toBeDefined();
        
        // Simulate double-click
        doubleClickHandler();
        
        // Verify window was toggled
        expect(mockWindowManager.toggle).toHaveBeenCalled();
      });
      
      it('should not set up double-click handler on macOS', () => {
        const { Tray } = require('electron');
        const { getPlatformAdapter } = require('../platform');
        
        // Mock macOS platform
        getPlatformAdapter.mockReturnValue({
          getPlatform: jest.fn().mockReturnValue('macos'),
          openLogFolder: jest.fn()
        });
        
        TrayIconManager.resetInstance();
        const trayManager = TrayIconManager.getInstance(serverManager);
        trayManager.initialize();
        
        const mockTray = Tray.mock.results[0].value;
        
        // Verify double-click handler was NOT registered on macOS
        const doubleClickCall = mockTray.on.mock.calls.find(
          (call: any) => call[0] === 'double-click'
        );
        
        expect(doubleClickCall).toBeUndefined();
      });
      
      it('should handle double-click when window manager is not set', () => {
        const { Tray } = require('electron');
        const { getPlatformAdapter } = require('../platform');
        
        // Mock Windows platform
        getPlatformAdapter.mockReturnValue({
          getPlatform: jest.fn().mockReturnValue('windows'),
          openLogFolder: jest.fn()
        });
        
        TrayIconManager.resetInstance();
        const trayManager = TrayIconManager.getInstance(serverManager);
        
        // Don't set window manager
        trayManager.initialize();
        
        const mockTray = Tray.mock.results[0].value;
        
        // Get the double-click handler
        const doubleClickHandler = mockTray.on.mock.calls.find(
          (call: any) => call[0] === 'double-click'
        )?.[1];
        
        expect(doubleClickHandler).toBeDefined();
        
        // Simulate double-click - should not throw
        expect(() => doubleClickHandler()).not.toThrow();
      });
    });
    
    describe('Right-Click Event (Context Menu)', () => {
      it('should set context menu on initialization', () => {
        const { Tray } = require('electron');
        const trayManager = TrayIconManager.getInstance(serverManager);
        trayManager.initialize();
        
        const mockTray = Tray.mock.results[0].value;
        
        // Verify context menu was set
        expect(mockTray.setContextMenu).toHaveBeenCalled();
      });
      
      it('should update context menu when state changes', () => {
        const { Tray } = require('electron');
        const trayManager = TrayIconManager.getInstance(serverManager);
        trayManager.initialize();
        
        const mockTray = Tray.mock.results[0].value;
        const initialCallCount = mockTray.setContextMenu.mock.calls.length;
        
        // Change state
        trayManager.updateIcon(TrayIconState.RUNNING);
        
        // Context menu should be updated
        expect(mockTray.setContextMenu.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
      
      it('should handle context menu on all platforms', () => {
        const { Tray } = require('electron');
        const { getPlatformAdapter } = require('../platform');
        
        const platforms = ['windows', 'macos', 'linux'];
        
        platforms.forEach(platform => {
          // Mock platform
          getPlatformAdapter.mockReturnValue({
            getPlatform: jest.fn().mockReturnValue(platform),
            openLogFolder: jest.fn()
          });
          
          TrayIconManager.resetInstance();
          const trayManager = TrayIconManager.getInstance(serverManager);
          trayManager.initialize();
          
          const mockTray = Tray.mock.results[0].value;
          
          // Verify context menu was set on all platforms
          expect(mockTray.setContextMenu).toHaveBeenCalled();
        });
      });
    });
  });
});

