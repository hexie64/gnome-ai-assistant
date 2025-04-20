import { SettingsKeys, LLMProviders } from "./constants.js";

/**
 * Manages extension settings with a cleaner interface
 */
export class SettingsManager {
    /**
     * Create a settings manager
     * @param {Gio.Settings} settings - GNOME extension settings
     */
    constructor(settings) {
        this._settings = settings;
        this._settingsChangedCallbacks = new Map();
    }

    /**
     * Connect a callback to settings changes
     * @param {Function} callback - Callback to invoke on settings changes
     * @returns {number} - Callback ID for disconnection
     */
    connectToChanges(callback) {
        const id = this._settings.connect("changed", callback);
        this._settingsChangedCallbacks.set(callback, id);
        return id;
    }

    /**
     * Disconnect a settings change callback
     * @param {Function} callback - Callback to disconnect
     */
    disconnectFromChanges(callback) {
        const id = this._settingsChangedCallbacks.get(callback);
        if (id !== undefined) {
            this._settings.disconnect(id);
            this._settingsChangedCallbacks.delete(callback);
        }
    }

    /**
     * Disconnect all settings change callbacks
     */
    disconnectAll() {
        for (const [callback, id] of this._settingsChangedCallbacks.entries()) {
            this._settings.disconnect(id);
            this._settingsChangedCallbacks.delete(callback);
        }
    }

    /**
     * Get the currently selected LLM provider
     * @returns {string} - Provider type
     */
    getLLMProvider() {
        return this._settings.get_string(SettingsKeys.LLM_PROVIDER);
    }

    /**
     * Get the API key for the specified provider
     * @param {string} provider - Provider type
     * @returns {string} - API key
     */
    getApiKey(provider) {
        switch (provider) {
            case LLMProviders.ANTHROPIC:
                return this._settings.get_string(SettingsKeys.ANTHROPIC_API_KEY);
            case LLMProviders.OPENAI:
                return this._settings.get_string(SettingsKeys.OPENAI_API_KEY);
            case LLMProviders.GEMINI:
                return this._settings.get_string(SettingsKeys.GEMINI_API_KEY);
            case LLMProviders.OPENROUTER:
                return this._settings.get_string(SettingsKeys.OPENROUTER_API_KEY);
            default:
                return "";
        }
    }

    /**
     * Get the model for the specified provider
     * @param {string} provider - Provider type
     * @returns {string} - Model name
     */
    getModel(provider) {
        switch (provider) {
            case LLMProviders.ANTHROPIC:
                return this._settings.get_string(SettingsKeys.ANTHROPIC_MODEL);
            case LLMProviders.OPENAI:
                return this._settings.get_string(SettingsKeys.OPENAI_MODEL);
            case LLMProviders.GEMINI:
                return this._settings.get_string(SettingsKeys.GEMINI_MODEL);
            case LLMProviders.OPENROUTER:
                return this._settings.get_string(SettingsKeys.OPENROUTER_MODEL);
            default:
                return "";
        }
    }

    /**
     * Get the chat history
     * @returns {Array} - Chat history
     */
    getHistory() {
        try {
            return JSON.parse(this._settings.get_string(SettingsKeys.HISTORY) || "[]");
        } catch (e) {
            logError(e, "Failed to parse chat history");
            return [];
        }
    }

    /**
     * Set the chat history
     * @param {Array} history - Chat history
     */
    setHistory(history) {
        this._settings.set_string(SettingsKeys.HISTORY, JSON.stringify(history));
    }

    /**
     * Get visual styling settings
     * @returns {object} - Object containing styling settings
     */
    getStyleSettings() {
        return {
            humanMessageColor:     this._settings.get_string(SettingsKeys.HUMAN_MESSAGE_COLOR),
            llmMessageColor:       this._settings.get_string(SettingsKeys.LLM_MESSAGE_COLOR),
            humanMessageTextColor: this._settings.get_string(SettingsKeys.HUMAN_MESSAGE_TEXT_COLOR),
            llmMessageTextColor:   this._settings.get_string(SettingsKeys.LLM_MESSAGE_TEXT_COLOR),
        };
    }

    /**
     * Get keyboard shortcut for opening the chat
     * @returns {string} - Keyboard shortcut
     */
    getOpenChatShortcut() {
        const shortcuts = this._settings.get_strv(SettingsKeys.OPEN_CHAT_SHORTCUT);
        return shortcuts.length > 0 ? shortcuts[0] : "";
    }

    getDialogShortcut() {
        const shortcuts = this._settings.get_strv(SettingsKeys.OPEN_DIALOG_SHORTCUT);
        return shortcuts.length > 0 ? shortcuts[0] : "";
    }

    /**
     * Set the LLM provider
     * @param {string} provider - Provider type
     */
    setLLMProvider(provider) {
        this._settings.set_string(SettingsKeys.LLM_PROVIDER, provider);
    }

    /**
     * Set the API key for a provider
     * @param {string} provider - Provider type
     * @param {string} apiKey - API key
     */
    setApiKey(provider, apiKey) {
        switch (provider) {
            case LLMProviders.ANTHROPIC:
                this._settings.set_string(SettingsKeys.ANTHROPIC_API_KEY, apiKey);
                break;
            case LLMProviders.OPENAI:
                this._settings.set_string(SettingsKeys.OPENAI_API_KEY, apiKey);
                break;
            case LLMProviders.GEMINI:
                this._settings.set_string(SettingsKeys.GEMINI_API_KEY, apiKey);
                break;
            case LLMProviders.OPENROUTER:
                this._settings.set_string(SettingsKeys.OPENROUTER_API_KEY, apiKey);
                break;
        }
    }

    /**
     * Set the model for a provider
     * @param {string} provider - Provider type
     * @param {string} model - Model name
     */
    setModel(provider, model) {
        switch (provider) {
            case LLMProviders.ANTHROPIC:
                this._settings.set_string(SettingsKeys.ANTHROPIC_MODEL, model);
                break;
            case LLMProviders.OPENAI:
                this._settings.set_string(SettingsKeys.OPENAI_MODEL, model);
                break;
            case LLMProviders.GEMINI:
                this._settings.set_string(SettingsKeys.GEMINI_MODEL, model);
                break;
            case LLMProviders.OPENROUTER:
                this._settings.set_string(SettingsKeys.OPENROUTER_MODEL, model);
                break;
        }
    }

    /**
     * Set the visual style settings
     * @param {object} styleSettings - Object containing style settings
     */
    setStyleSettings(styleSettings) {
        if (styleSettings.humanMessageColor) {
            this._settings.set_string(SettingsKeys.HUMAN_MESSAGE_COLOR, styleSettings.humanMessageColor);
        }

        if (styleSettings.llmMessageColor) {
            this._settings.set_string(SettingsKeys.LLM_MESSAGE_COLOR, styleSettings.llmMessageColor);
        }

        if (styleSettings.humanMessageTextColor) {
            this._settings.set_string(SettingsKeys.HUMAN_MESSAGE_TEXT_COLOR, styleSettings.humanMessageTextColor);
        }

        if (styleSettings.llmMessageTextColor) {
            this._settings.set_string(SettingsKeys.LLM_MESSAGE_TEXT_COLOR, styleSettings.llmMessageTextColor);
        }
    }

    /**
     * Set keyboard shortcut for opening the chat
     * @param {string} shortcut - Keyboard shortcut string
     */
    setOpenChatShortcut(shortcut) {
        this._settings.set_strv(SettingsKeys.OPEN_CHAT_SHORTCUT, [shortcut]);
    }

    /**
     * Get a generic setting by key
     * @param {string} key - Setting key
     * @returns {any} - Setting value
     */
    getSetting(key) {
        const type = this._settings.get_value(key).get_type_string();

        switch (type) {
            case "s":
                return this._settings.get_string(key);
            case "b":
                return this._settings.get_boolean(key);
            case "i":
                return this._settings.get_int(key);
            case "d":
                return this._settings.get_double(key);
            case "as":
                return this._settings.get_strv(key);
            default:
                return null;
        }
    }

    /**
     * Set a generic setting by key
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     */
    setSetting(key, value) {
        const type = this._settings.get_value(key).get_type_string();

        switch (type) {
            case "s":
                this._settings.set_string(key, String(value));
                break;
            case "b":
                this._settings.set_boolean(key, Boolean(value));
                break;
            case "i":
                this._settings.set_int(key, Number(value));
                break;
            case "d":
                this._settings.set_double(key, Number(value));
                break;
            case "as":
                if (Array.isArray(value)) {
                    this._settings.set_strv(key, value);
                } else {
                    this._settings.set_strv(key, [String(value)]);
                }
                break;
        }
    }

    /**
     * Reset all settings to default values
     */
    resetToDefaults() {
        for (const key in SettingsKeys) {
            this._settings.reset(SettingsKeys[key]);
        }
    }
}
