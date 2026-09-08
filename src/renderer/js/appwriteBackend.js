// HydroWeb Appwrite Backend Integration
window.AppwriteBackend = {
  client: null,
  databases: null,
  account: null,
  isConfigured: false,
  
  // Appwrite Configuration
  config: {
    endpoint: 'https://cloud.appwrite.io/v1',
    projectId: 'hydroweb',
    databaseId: 'hydroweb_db',
    settingsCollectionId: 'settings',
    statsCollectionId: 'stats'
  },

  async init(userConfig = {}) {
    this.config = { ...this.config, ...userConfig };
    
    if (typeof Appwrite !== 'undefined') {
      try {
        const { Client, Databases, Account } = Appwrite;
        this.client = new Client()
          .setEndpoint(this.config.endpoint)
          .setProject(this.config.projectId);
        
        this.databases = new Databases(this.client);
        this.account = new Account(this.client);
        
        await this._ensureSession();
        this.isConfigured = true;
        console.log('⚡ HydroWeb Appwrite Backend Initialized successfully.');
      } catch (e) {
        console.warn('Appwrite backend init warning (operating in local fallback):', e.message);
        this.isConfigured = false;
      }
    } else {
      console.log('Appwrite SDK operating in local sync mode.');
    }
  },

  async _ensureSession() {
    if (!this.account) return;
    try {
      await this.account.get();
    } catch (e) {
      try {
        await this.account.createAnonymousSession();
      } catch (err) {
        console.warn('Anonymous session skipped:', err.message);
      }
    }
  },

  async saveSettings(settings) {
    if (!this.isConfigured || !this.databases) return false;
    try {
      await this.databases.createDocument(
        this.config.databaseId,
        this.config.settingsCollectionId,
        'user_settings',
        settings
      );
      return true;
    } catch (e) {
      try {
        await this.databases.updateDocument(
          this.config.databaseId,
          this.config.settingsCollectionId,
          'user_settings',
          settings
        );
        return true;
      } catch (err) {
        return false;
      }
    }
  },

  async recordGlass(stats) {
    if (!this.isConfigured || !this.databases) return false;
    const today = new Date().toISOString().split('T')[0];
    try {
      await this.databases.createDocument(
        this.config.databaseId,
        this.config.statsCollectionId,
        today,
        { glasses: stats.glasses, reminders: stats.reminders, streak: stats.streak || 1 }
      );
      return true;
    } catch (e) {
      try {
        await this.databases.updateDocument(
          this.config.databaseId,
          this.config.statsCollectionId,
          today,
          { glasses: stats.glasses, reminders: stats.reminders, streak: stats.streak || 1 }
        );
        return true;
      } catch (err) {
        return false;
      }
    }
  }
};
