import St from "gi://St";
import GLib from "gi://GLib";
import Pango from "gi://Pango";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import Clutter from 'gi://Clutter';
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { UI } from "./constants.js";

/**
 * Sets up a keyboard shortcut
 * @param {string} shortcut - Keyboard shortcut string
 * @param {object} settings - Extension settings
 * @param {Function} callback - Callback to run when shortcut is pressed
 * @returns {boolean} - Whether shortcut was successfully bound
 */

export function setupShortcut(setting, shortcut, settings, callback) {
    if (!shortcut) {
        return false;
    }

    try {
        Main.wm.addKeybinding(
            setting,
            settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            callback
        );
        return true;
    } catch (e) {
        logError(e, "Failed to set up keyboard shortcut");
        return false;
    }
}

/**
 * Removes a keyboard shortcut
 */
export function removeShortcut() {
    try {
        Main.wm.removeKeybinding("open-chat-shortcut");
    } catch (e) {
        logError(e, "Failed to remove keyboard shortcut");
    }
}

/**
 * Format a string by replacing placeholders with arguments
 * @param {string} format - String with {n} placeholders
 * @param {...any} args - Arguments to substitute
 * @returns {string} - Formatted string
 */
export function formatString(format, ...args) {
    return format.replace(/{(\d+)}/g, (match, index) => {
        return typeof args[index] !== "undefined" ? args[index] : match;
    });
}

/**
 * Safely schedule a function to run after a delay
 * @param {Function} func - Function to call
 * @param {number} delay - Delay in milliseconds
 * @returns {number} - Timeout ID
 */
export function safeTimeout(func, delay) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
        try {
            func();
        } catch (e) {
            logError(e, "Error in timeout callback");
        }
        return GLib.SOURCE_REMOVE;
    });
}

/**
 * Schedule focus on an input field
 * @param {St.Entry} input - Input element to focus
 * @param {number} delay - Delay in milliseconds
 * @returns {number} - Timeout ID
 */
export function focusInput(input, delay = 50) {
    return safeTimeout(() => {
        if (input && input.grab_key_focus) {
            input.grab_key_focus();
        }
    }, delay);
}

