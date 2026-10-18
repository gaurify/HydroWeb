window.AppwriteBackend = {
  client: null,
  databases: null,
  account: null,
  isConfigured: false,
  hasWarnedMissingConfig: false,

  config: {
    endpoint: 'https://cloud.appwrite.io/v1',
    projectId: '',
    databaseId: '',
    settingsCollectionId: '',
    statsCollectionId: ''
  },

  async init(userConfig = {}) {
    this.config = { ...this.config, ...userConfig };

    const required = ['projectId', 'databaseId', 'settingsCollectionId', 'statsCollectionId'];
    const missing = required.filter((field) => !this.config[field]);

    if (missing.length > 0) {
      if (!this.hasWarnedMissingConfig) {
        console.warn(`Appwrite disabled: missing configuration fields: ${missing.join(', ')}`);
        this.hasWarnedMissingConfig = true;
      }
      this.isConfigured = false;
      return;
    }

    if (typeof Appwrite === 'undefined') {
      console.warn('Appwrite SDK not found. Falling back to local storage.');
      this.isConfigured = false;
      return;
    }

    try {
      const { Client, Databases, Account } = Appwrite;
      this.client = new Client().setEndpoint(this.config.endpoint).setProject(this.config.projectId);
      this.databases = new Databases(this.client);
      this.account = new Account(this.client);
      await this._ensureSession();
      this.isConfigured = true;
      console.log('HydroWeb Appwrite backend initialized.');
    } catch (error) {
      console.warn('Appwrite init failed. Continuing with local storage.', error?.message || error);
      this.isConfigured = false;
    }
  },

  async _ensureSession() {
    if (!this.account) return;
    try {
      await this.account.get();
    } catch (_error) {
      await this.account.createAnonymousSession();
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
    } catch (_error) {
      try {
        await this.databases.updateDocument(
          this.config.databaseId,
          this.config.settingsCollectionId,
          'user_settings',
          settings
        );
        return true;
      } catch {
        return false;
      }
    }
  },

  async recordDay(stats) {
    if (!this.isConfigured || !this.databases || !stats?.date) return false;

    const payload = {
      date: stats.date,
      totalMl: Number(stats.volumeMl || 0),
      goalMl: Number(stats.goalVolumeMl || 0),
      reminders: Number(stats.reminders || 0),
      streak: Number(stats.streak || 0)
    };

    try {
      await this.databases.createDocument(
        this.config.databaseId,
        this.config.statsCollectionId,
        stats.date,
        payload
      );
      return true;
    } catch (_error) {
      try {
        await this.databases.updateDocument(
          this.config.databaseId,
          this.config.statsCollectionId,
          stats.date,
          payload
        );
        return true;
      } catch {
        return false;
      }
    }
  }
};
