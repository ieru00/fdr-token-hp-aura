class TokenHealthAura {
  static ID = "token-health-aura";

  static FLAGS = {
    DISABLE_AURA: "disableAura",
    GLOBAL_DISABLE: "globalDisable",
  };

  static AVAILABLE_AURAS = {
    dim: "Dim Light Aura",
    bright: "Bright Light Aura",
    both: "Both Dim & Bright",
  };

  static initialize() {
    this.registerSettings();
    this.hookTokenUpdates();
    this.hookSettingsChange();
    this.hookTokenConfig();
    this.registerHotkeys();
    game.modules.get(this.ID).api = this.API;
  }

  static updateAllTokens() {
    console.log(`${this.ID} | Updating all tokens after settings change`);
    canvas.scene?.tokens?.forEach((tokenDocument) => {
      if (tokenDocument.actor) {
        this.updateTokenAura(tokenDocument);
      }
    });
  }

  static registerHotkeys() {
    game.keybindings.register(this.ID, "toggleAuras", {
      name: "Toggle Health Auras",
      hint: "Globally enables or disables all health auras",
      editable: [
        {
          key: "BracketRight", // Changed from KeyH to BracketRight (])
          modifiers: ["Control"],
        },
      ],
      restricted: false, // Allow players to use the hotkey
      onDown: () => {
        const currentState = game.settings.get(this.ID, "globallyDisabled");
        game.settings.set(this.ID, "globallyDisabled", !currentState);
        //ui.notifications.info(`Health Auras ${!currentState ? 'Disabled' : 'Enabled'}`);
        this.updateAllTokens();
      },
    });
  }

  static hookSettingsChange() {
    const settingsToWatch = [
      "auraType",
      "thresholds",
      "auraAlpha",
      "auraDim",
      "auraBright",
      "enablePulse",
    ];

    settingsToWatch.forEach((key) => {
      const fullKey = `${this.ID}.${key}`;
      Hooks.on("updateSetting", (setting) => {
        if (setting.key === fullKey) {
          this.updateAllTokens();
        }
      });
    });
  }

  static hookTokenConfig() {
    Hooks.on("renderTokenConfig", (app, html, data) => {
      const visionTab = html.find('div[data-tab="vision"]');
      const disabled =
        app.token.getFlag(this.ID, this.FLAGS.DISABLE_AURA) ?? false;

      const formGroup = $(`
                <div class="form-group">
                    <label>Health Aura</label>
                    <div class="form-fields">
                        <label class="checkbox">
                            <input type="checkbox" name="flags.${this.ID}.${
        this.FLAGS.DISABLE_AURA
      }" 
                                   ${disabled ? "checked" : ""}>
                            Disable health aura for this token
                        </label>
                    </div>
                    <p class="notes">Override the module's health aura display for this specific token.</p>
                </div>
            `);

      formGroup.insertAfter(visionTab);
    });
  }

  static hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert 3-digit hex to 6-digit
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return { r, g, b };
}

static rgbToHex({ r, g, b }) {
    const toHex = (n) => {
        const hex = Math.round(n).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

static interpolateColor(color1, color2, factor) {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    const r = rgb1.r + (rgb2.r - rgb1.r) * factor;
    const g = rgb1.g + (rgb2.g - rgb1.g) * factor;
    const b = rgb1.b + (rgb2.b - rgb1.b) * factor;
    
    return this.rgbToHex({ r, g, b });
}

static getGradientColor(healthPercentage, thresholds) {
    console.group(`${this.ID} | Gradient Calculation Details`);
    console.log(`Current Health: ${healthPercentage}%`);
    console.log(`Available Thresholds:`, thresholds);

    // If no thresholds or only one threshold, return the single color
    if (!thresholds.length) {
        console.log('No thresholds found, returning black');
        console.groupEnd();
        return "#000000";
    }
    if (thresholds.length === 1) {
        console.log('Only one threshold found, returning its color:', thresholds[0].color);
        console.groupEnd();
        return thresholds[0].color;
    }

    // Sort thresholds from highest to lowest
    const sorted = [...thresholds].sort((a, b) => b.threshold - a.threshold);
    console.log(`Sorted thresholds:`, sorted.map(t => `${t.threshold}% (${t.color})`));

    // If health is above highest threshold, return no color
    if (healthPercentage > sorted[0].threshold) {
        console.log(`Health (${healthPercentage}%) is above highest threshold (${sorted[0].threshold}%), returning no color`);
        console.groupEnd();
        return "";
    }

    // If health is below lowest threshold, return that color
    if (healthPercentage <= sorted[sorted.length - 1].threshold) {
        console.log(`Health (${healthPercentage}%) is below lowest threshold (${sorted[sorted.length - 1].threshold}%), returning lowest color: ${sorted[sorted.length - 1].color}`);
        console.groupEnd();
        return sorted[sorted.length - 1].color;
    }

    // Find the two thresholds we're between
    for (let i = 0; i < sorted.length - 1; i++) {
        const upperThreshold = sorted[i];
        const lowerThreshold = sorted[i + 1];

        console.log(`Checking if ${healthPercentage}% is between ${upperThreshold.threshold}% and ${lowerThreshold.threshold}%`);

        if (healthPercentage <= upperThreshold.threshold && 
            healthPercentage > lowerThreshold.threshold) {
            
            const range = upperThreshold.threshold - lowerThreshold.threshold;
            const distanceFromUpper = upperThreshold.threshold - healthPercentage;
            const factor = distanceFromUpper / range;

            console.log('Found matching threshold range!');
            console.log(`Range between thresholds: ${range}%`);
            console.log(`Distance from upper threshold: ${distanceFromUpper}%`);
            console.log(`Interpolation factor: ${factor}`);
            console.log(`Interpolating between colors:`, {
                upper: upperThreshold.color,
                lower: lowerThreshold.color
            });

            const resultColor = this.interpolateColor(
                upperThreshold.color,
                lowerThreshold.color,
                factor
            );
            
            console.log(`Calculated color: ${resultColor}`);
            console.groupEnd();
            return resultColor;
        }
    }

    console.log(`No matching range found, returning highest threshold color: ${sorted[0].color}`);
    console.groupEnd();
    return sorted[0].color;
}

  static registerSettings() {
    class TokenHealthAuraSettings extends FormApplication {
      static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
          id: "token-health-aura-settings",
          title: "Token Health Aura Settings",
          template: "modules/token-health-aura/templates/settings.html",
          width: 600,
          height: "auto",
          closeOnSubmit: false,
        });
      }

      getData() {
        const data = super.getData();
        data.settings = {
          auraType: game.settings.get(TokenHealthAura.ID, "auraType"),
          thresholds: game.settings.get(TokenHealthAura.ID, "thresholds"),
          auraAlpha: game.settings.get(TokenHealthAura.ID, "auraAlpha"),
          auraDim: game.settings.get(TokenHealthAura.ID, "auraDim"),
          auraBright: game.settings.get(TokenHealthAura.ID, "auraBright"),
          enablePulse: game.settings.get(TokenHealthAura.ID, "enablePulse"),
        };
        return data;
      }

      activateListeners(html) {
        super.activateListeners(html);
        html.find(".add-threshold").click(this._onAddThreshold.bind(this));
        html
          .find(".remove-threshold")
          .click(this._onRemoveThreshold.bind(this));
      }

      _onAddThreshold(event) {
        event.preventDefault();
        const thresholds = duplicate(
          game.settings.get(TokenHealthAura.ID, "thresholds")
        );

        const currentValues = thresholds
          .map((t) => t.threshold)
          .sort((a, b) => b - a);
        let newValue = 50;

        if (currentValues.length > 0) {
          let prevValue = 100;
          for (const value of currentValues) {
            if (prevValue - value > 15) {
              newValue = Math.floor((prevValue + value) / 2);
              break;
            }
            prevValue = value;
          }
          if (newValue === 50) {
            newValue = Math.floor(currentValues[currentValues.length - 1] / 2);
          }
        }

        thresholds.push({
          threshold: newValue,
          color: "#ffff00",
        });

        thresholds.sort((a, b) => b.threshold - a.threshold);
        game.settings
          .set(TokenHealthAura.ID, "thresholds", thresholds)
          .then(() => this.render(true));
      }

      _onRemoveThreshold(event) {
        event.preventDefault();
        const index =
          event.currentTarget.closest(".threshold-entry").dataset.index;
        const thresholds = duplicate(
          game.settings.get(TokenHealthAura.ID, "thresholds")
        );

        thresholds.splice(index, 1);
        game.settings
          .set(TokenHealthAura.ID, "thresholds", thresholds)
          .then(() => this.render(true));
      }

      _updateObject(event, formData) {
        const data = expandObject(formData);
        const promises = [];

        // Handle thresholds
        if (data.thresholds) {
          const newThresholds = Object.values(data.thresholds)
            .map((t) => ({
              threshold: parseInt(t.threshold),
              color: t.color,
            }))
            .sort((a, b) => b.threshold - a.threshold);

          promises.push(
            game.settings.set(TokenHealthAura.ID, "thresholds", newThresholds)
          );
        }

        // Handle other settings including gmOnly
        const settingKeys = [
          "auraType",
          "auraAlpha",
          "auraDim",
          "auraBright",
          "enablePulse",
          "gmOnly",
        ];
        settingKeys.forEach((key) => {
          if (data[key] !== undefined) {
            promises.push(
              game.settings.set(TokenHealthAura.ID, key, data[key])
            );
          }
        });

        // After settings are saved, update all tokens to reflect changes
        Promise.all(promises).then(() => TokenHealthAura.updateAllTokens());

        return Promise.all(promises);
      }
    }

    this.settingsClass = TokenHealthAuraSettings;

    game.settings.register(this.ID, "auraType", {
      name: "Aura Type",
      hint: "Choose which type of aura to display",
      scope: "world",
      config: false,
      type: String,
      choices: this.AVAILABLE_AURAS,
      default: "dim",
    });

    game.settings.register(this.ID, "thresholds", {
      name: "Health Thresholds",
      scope: "world",
      config: false,
      type: Array,
      default: [
        { threshold: 50, color: "#ffff00" },
        { threshold: 25, color: "#ff0000" },
      ],
    });

    game.settings.register(this.ID, "auraAlpha", {
      name: "Aura Opacity",
      hint: "Opacity of the health auras (0.1-0.3)",
      scope: "world",
      config: false,
      type: Number,
      default: 0.1,
      range: {
        min: 0.1,
        max: 0.3,
        step: 0.05,
      },
    });

    game.settings.register(this.ID, "auraDim", {
      name: "Dim Light Range",
      hint: "Range of the dim light aura (0-3)",
      scope: "world",
      config: false,
      type: Number,
      default: 1,
      range: {
        min: 0,
        max: 3,
        step: 0.5,
      },
    });

    game.settings.register(this.ID, "auraBright", {
      name: "Bright Light Range",
      hint: "Range of the bright light aura (0-2)",
      scope: "world",
      config: false,
      type: Number,
      default: 0,
      range: {
        min: 0,
        max: 2,
        step: 0.5,
      },
    });

    game.settings.register(this.ID, "enablePulse", {
      name: "Enable Pulse Animation",
      hint: "Toggle pulsing animation for health auras",
      scope: "world",
      config: false,
      type: Boolean,
      default: true,
    });

    game.settings.registerMenu(this.ID, "settingsMenu", {
      name: "Token Health Aura Settings",
      label: "Open Settings",
      hint: "Configure token health aura settings with live update capability",
      icon: "fas fa-cogs",
      type: TokenHealthAuraSettings,
      restricted: true,
    });

    game.settings.register(this.ID, "globallyDisabled", {
      name: "Globally Disabled",
      hint: "Temporarily disable all auras",
      scope: "client",
      config: false,
      type: Boolean,
      default: false,
    });
  }

  static hookTokenUpdates() {
    const debounceUpdate = foundry.utils.debounce(
      this.updateTokenAura.bind(this),
      100
    );

    Hooks.on("updateToken", (tokenDocument, updates, options, userId) => {
      // Only respond to HP changes or specific light updates from this module
      const hasHPChange =
        updates?.actorData?.system?.attributes?.hp !== undefined;
      const isAuraUpdate =
        updates?.light !== undefined && options?.source === this.ID;

      if (hasHPChange || isAuraUpdate) {
        debounceUpdate(tokenDocument);
      }
    });

    Hooks.on("updateActor", (actor, updates, options, userId) => {
      // Only respond to HP changes
      if (updates?.system?.attributes?.hp !== undefined) {
        actor.getActiveTokens().forEach((token) => {
          const tokenDocument = token.document;
          debounceUpdate(tokenDocument);
        });
      }
    });
  }

  static getHealthData(actor) {
    if (!actor) return null;

    const system = game.system.id;

    switch (system) {
      case "dnd5e":
        return {
          current: actor.system.attributes.hp.value,
          max: actor.system.attributes.hp.max,
        };
      case "pf2e":
        return {
          current: actor.system.attributes.hp.value,
          max: actor.system.attributes.hp.max,
        };
      default:
        console.warn(
          `${this.ID} | System '${system}' not explicitly supported, attempting generic HP detection`
        );
        try {
          const hp = actor.system.attributes?.hp || actor.system.hp;
          if (hp?.value !== undefined && hp?.max !== undefined) {
            return {
              current: hp.value,
              max: hp.max,
            };
          }
        } catch (err) {
          console.error(
            `${this.ID} | Failed to get HP values for system '${system}'`,
            err
          );
        }
        return null;
    }
  }

  static getAuraUpdates(healthPercentage, settings) {
    console.log(`${this.ID} | Checking health percentage:`, healthPercentage);
    console.log(`${this.ID} | Available thresholds:`, settings.thresholds);

    const baseAura = {
        dim: settings.auraType === 'bright' ? 0 : settings.auraDim,
        bright: settings.auraType === 'dim' ? 0 : settings.auraBright,
        alpha: settings.auraAlpha
    };

    const sortedThresholds = settings.thresholds.sort((a, b) => b.threshold - a.threshold);
    console.log(`${this.ID} | Sorted thresholds:`, sortedThresholds);

    // Calculate gradient color based on health
    const color = this.getGradientColor(healthPercentage, sortedThresholds);
    console.log(`${this.ID} | Gradient color result:`, color);

    // If no color (above all thresholds), return no aura
    if (!color) {
        return {
            light: {
                dim: 0,
                bright: 0,
                color: "",
                alpha: 0,
                animation: { type: "none", speed: 0, intensity: 0 }
            }
        };
    }

    // Calculate animation intensity based on health percentage
    const healthFactor = Math.min(1, Math.max(0, healthPercentage / 100));
    const baseIntensity = 5 - (healthFactor * 3);
    const baseSpeed = 5 - (healthFactor * 3);

    return {
        light: {
            ...baseAura,
            color: color,
            animation: settings.enablePulse ? {
                type: "pulse",
                speed: baseSpeed,
                intensity: baseIntensity
            } : { type: "none" }
        }
    };

    // Find the appropriate threshold bracket
    let activeThreshold = null;
    for (let i = 0; i < sortedThresholds.length; i++) {
        const currentThreshold = sortedThresholds[i];
        const nextThreshold = sortedThresholds[i + 1];

        // If this is the last threshold and we're below it
        if (!nextThreshold && healthPercentage <= currentThreshold.threshold) {
            activeThreshold = currentThreshold;
            break;
        }
        
        // If we're between this threshold and the next one
        if (nextThreshold && 
            healthPercentage <= currentThreshold.threshold && 
            healthPercentage > nextThreshold.threshold) {
            activeThreshold = currentThreshold;
            break;
        }
    }

    console.log(`${this.ID} | Matched threshold:`, activeThreshold);

    if (activeThreshold) {
        const thresholdIndex = sortedThresholds.indexOf(activeThreshold);
        const nextThreshold = sortedThresholds[thresholdIndex + 1];
        const lowerBound = nextThreshold ? nextThreshold.threshold : 0;
        const range = activeThreshold.threshold - lowerBound;
        const healthIntoThreshold = healthPercentage - lowerBound;
        const percentIntoThreshold = range ? (healthIntoThreshold / range) : 0;

        const baseIntensity = 5 - (percentIntoThreshold * 2);
        const baseSpeed = 5 - (percentIntoThreshold * 2);

        return {
            light: {
                ...baseAura,
                color: activeThreshold.color,
                animation: settings.enablePulse ? {
                    type: "pulse",
                    speed: baseSpeed,
                    intensity: baseIntensity
                } : { type: "none" }
            }
        };
    }

    return {
        light: {
            dim: 0,
            bright: 0,
            color: "",
            alpha: 0,
            animation: { type: "none", speed: 0, intensity: 0 }
        }
    };
}

  static updateTokenAura(tokenDocument) {
    try {
        if (!tokenDocument) return;
        
        const actor = tokenDocument.actor;
        if (!actor) return;

        // Only check global disable and per-token disable
        const globallyDisabled = game.settings.get(this.ID, 'globallyDisabled');
        const isDisabled = tokenDocument.getFlag(this.ID, this.FLAGS.DISABLE_AURA);

        if (globallyDisabled || isDisabled) {
            return this.removeAura(tokenDocument);
        }

        // Only GMs should update token data to avoid permission errors
        if (!game.user.isGM) return;

        const healthData = this.getHealthData(actor);
        if (!healthData) return;

        const healthPercentage = (healthData.current / healthData.max) * 100;
        
        const settings = {
            auraType: game.settings.get(this.ID, 'auraType'),
            thresholds: game.settings.get(this.ID, 'thresholds'),
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
    },
  };

  static removeAura(tokenDocument) {
    return tokenDocument.update({
      light: {
        dim: 0,
        bright: 0,
        color: "",
        alpha: 0,
        animation: {
          type: "none",
          speed: 0,
          intensity: 0,
        },
      },
    });
  }
}


// Initialize the module
Hooks.once("init", () => {
  TokenHealthAura.initialize();
});
