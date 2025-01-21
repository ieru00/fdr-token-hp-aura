class TokenHealthAura {
  static ID = 'token-health-aura';
  
  static AVAILABLE_AURAS = {
      dim: "Dim Light Aura",
      bright: "Bright Light Aura",
      both: "Both Dim & Bright"
  };
  
  static initialize() {
      this.registerSettings();
      this.hookTokenUpdates();
      this.hookSettingsChange();
      game.modules.get(this.ID).api = this.API;
  }

  static updateAllTokens() {
      console.log(`${this.ID} | Updating all tokens after settings change`);
      canvas.scene?.tokens?.forEach(tokenDocument => {
          if (tokenDocument.actor) {
              this.updateTokenAura(tokenDocument);
          }
      });
  }

  static hookSettingsChange() {
      const settingsToWatch = [
          'auraType', 'halfHealthColor', 'quarterHealthColor', 
          'auraAlpha', 'auraDim', 'auraBright', 'enablePulse'
      ];

      settingsToWatch.forEach(key => {
          const fullKey = `${this.ID}.${key}`;
          Hooks.on('updateSetting', (setting) => {
              if (setting.key === fullKey) {
                  this.updateAllTokens();
              }
          });
      });
  }

  static registerSettings() {
    // Create a FormApplication subclass for our settings
    class TokenHealthAuraSettings extends FormApplication {
        static get defaultOptions() {
            return mergeObject(super.defaultOptions, {
                id: "token-health-aura-settings",
                title: "Token Health Aura Settings",
                template: "modules/token-health-aura/templates/settings.html",
                width: 600,
                height: "auto",
                closeOnSubmit: false
            });
        }

        getData(options) {
            const data = super.getData(options);
            data.settings = {
                auraType: game.settings.get(TokenHealthAura.ID, 'auraType'),
                halfHealthColor: game.settings.get(TokenHealthAura.ID, 'halfHealthColor'),
                quarterHealthColor: game.settings.get(TokenHealthAura.ID, 'quarterHealthColor'),
                auraAlpha: game.settings.get(TokenHealthAura.ID, 'auraAlpha'),
                auraDim: game.settings.get(TokenHealthAura.ID, 'auraDim'),
                auraBright: game.settings.get(TokenHealthAura.ID, 'auraBright'),
                enablePulse: game.settings.get(TokenHealthAura.ID, 'enablePulse')
            };
            return data;
        }

        async _updateObject(event, formData) {
            for (let [key, value] of Object.entries(formData)) {
                await game.settings.set(TokenHealthAura.ID, key, value);
            }
        }
    }

// Store the FormApplication class on the main class
this.settingsClass = TokenHealthAuraSettings;

// Register all settings
game.settings.register(this.ID, 'auraType', {
    name: 'Aura Type',
    hint: 'Choose which type of aura to display',
    scope: 'world',
    config: false,
    type: String,
    choices: this.AVAILABLE_AURAS,
    default: 'dim'
});

game.settings.register(this.ID, 'halfHealthColor', {
    name: 'Half Health Aura Color',
    hint: 'Color for tokens at half health (HTML color code)',
    scope: 'world',
    config: false,
    type: String,
    default: '#ffff00'
});

game.settings.register(this.ID, 'quarterHealthColor', {
    name: 'Quarter Health Aura Color',
    hint: 'Color for tokens at quarter health (HTML color code)',
    scope: 'world',
    config: false,
    type: String,
    default: '#ff0000'
});

game.settings.register(this.ID, 'auraAlpha', {
    name: 'Aura Opacity',
    hint: 'Opacity of the health auras (0.1-0.3)',
    scope: 'world',
    config: false,
    type: Number,
    default: 0.1,
    range: {
        min: 0.1,
        max: 0.3,
        step: 0.05
    }
});

game.settings.register(this.ID, 'auraDim', {
    name: 'Dim Light Range',
    hint: 'Range of the dim light aura (0-3)',
    scope: 'world',
    config: false,
    type: Number,
    default: 1,
    range: {
        min: 0,
        max: 3,
        step: 0.5
    }
});

game.settings.register(this.ID, 'auraBright', {
    name: 'Bright Light Range',
    hint: 'Range of the bright light aura (0-2)',
    scope: 'world',
    config: false,
    type: Number,
    default: 0,
    range: {
        min: 0,
        max: 2,
        step: 0.5
    }
});

game.settings.register(this.ID, 'enablePulse', {
    name: 'Enable Pulse Animation',
    hint: 'Toggle pulsing animation for health auras',
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
});

// Add a button to open our custom settings
game.settings.registerMenu(this.ID, 'settingsMenu', {
    name: 'Token Health Aura Settings',
    label: 'Open Settings',
    hint: 'Configure token health aura settings with live update capability',
    icon: 'fas fa-cogs',
    type: TokenHealthAuraSettings,
    restricted: true
});
}

static hookTokenUpdates() {
const debounceUpdate = foundry.utils.debounce(this.updateTokenAura.bind(this), 100);

Hooks.on('updateToken', (tokenDocument, updates, options, userId) => {
    debounceUpdate(tokenDocument);
});

Hooks.on('updateActor', (actor, updates, options, userId) => {
    actor.getActiveTokens().forEach(token => {
        const tokenDocument = token.document;
        debounceUpdate(tokenDocument);
    });
});
}

static getHealthData(actor) {
if (!actor) return null;

const system = game.system.id;

switch(system) {
    case 'dnd5e':
        return {
            current: actor.system.attributes.hp.value,
            max: actor.system.attributes.hp.max
        };
    case 'pf2e':
        return {
            current: actor.system.attributes.hp.value,
            max: actor.system.attributes.hp.max
        };
    default:
        console.warn(`${this.ID} | System '${system}' not explicitly supported, attempting generic HP detection`);
        try {
            const hp = actor.system.attributes?.hp || actor.system.hp;
            if (hp?.value !== undefined && hp?.max !== undefined) {
                return {
                    current: hp.value,
                    max: hp.max
                };
            }
        } catch(err) {
            console.error(`${this.ID} | Failed to get HP values for system '${system}'`, err);
        }
        return null;
}
}

static getAuraUpdates(healthPercentage, settings) {
  // Get the aura ranges based on settings
  const baseAura = {
      dim: settings.auraType === 'bright' ? 0 : settings.auraDim,
      bright: settings.auraType === 'dim' ? 0 : settings.auraBright,
      alpha: settings.auraAlpha
  };

  if (healthPercentage <= 25) {
      return {
          light: {
              ...baseAura,
              color: settings.quarterHealthColor,
              animation: settings.enablePulse ? {
                  type: "pulse",
                  speed: 5,
                  intensity: 5
              } : { type: "none" }
          }
      };
  } else if (healthPercentage <= 50) {
      return {
          light: {
              ...baseAura,
              color: settings.halfHealthColor,
              animation: settings.enablePulse ? {
                  type: "pulse",
                  speed: 3,
                  intensity: 3
              } : { type: "none" }
          }
      };
  } else {
      return {
          light: {
              dim: 0,
              bright: 0,
              color: "",
              alpha: 0,
              animation: {
                  type: "none",
                  speed: 0,
                  intensity: 0
              }
          }
      };
  }
}

static updateTokenAura(tokenDocument) {
  try {
      if (!tokenDocument) return;
      
      const actor = tokenDocument.actor;
      if (!actor) return;

      const healthData = this.getHealthData(actor);
      if (!healthData) return;

      const healthPercentage = (healthData.current / healthData.max) * 100;
      
      // Get settings
      const settings = {
          auraType: game.settings.get(this.ID, 'auraType'),
          halfHealthColor: game.settings.get(this.ID, 'halfHealthColor'),
          quarterHealthColor: game.settings.get(this.ID, 'quarterHealthColor'),
          auraAlpha: game.settings.get(this.ID, 'auraAlpha'),
          auraDim: game.settings.get(this.ID, 'auraDim'),
          auraBright: game.settings.get(this.ID, 'auraBright'),
          enablePulse: game.settings.get(this.ID, 'enablePulse')
      };

      const updates = this.getAuraUpdates(healthPercentage, settings);
      
      return tokenDocument.update(updates).catch(err => {
          console.error(`${this.ID} | Error updating token aura:`, err);
      });
  } catch(err) {
      console.error(`${this.ID} | Error in updateTokenAura:`, err);
  }
}

static API = {
  updateAura: (token) => {
      const tokenDocument = token.document ?? token;
      return this.updateTokenAura(tokenDocument);
  },
  getHealthPercentage: (token) => {
      const tokenDocument = token.document ?? token;
      const healthData = this.getHealthData(tokenDocument.actor);
      return healthData ? (healthData.current / healthData.max) * 100 : null;
  },
  updateAllTokens: () => {
      return this.updateAllTokens();
  }
};
}

// Initialize the module
Hooks.once('init', () => {
TokenHealthAura.initialize();
});