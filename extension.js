/**
 * Gnome AI Assistant for GNOME
 *
 * A GNOME Shell extension that integrates AI assistant capabilities
 * with support for multiple LLM providers, and making screenshots.
 *
 * Based on work existing extension located at:
 * https://github.com/martijara/Penguin-AI-Chatbot-for-GNOME
 */

import Gio from 'gi://Gio';
import GObject from "gi://GObject";
import St from "gi://St";
import Shell from 'gi://Shell';
import GLib from "gi://GLib";

import {Extension, gettext as _} from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {captureScreenshot} from './lib/screenshot.js'

import {SettingsManager} from "./lib/settings.js";
import {LLMProviderFactory} from "./lib/llmProviders.js";
import {ChatMessageDisplay} from "./lib/chatUI.js";
import {setupShortcut, removeShortcut, formatString, focusInput} from "./lib/utils.js";
import {MessageRoles, CSS, UI} from "./lib/constants.js";
import {hideTooltip, showTooltip} from "./lib/tooltip.js";

let isPanelHidden = true;

const RightPanel = GObject.registerClass(
    class RightPanel extends PanelMenu.Button {

        /**
         * Initialize the Gnome Assistant chat interface
         * @param extension
         * @private
         */
        _init(extension) {
            super._init(0.0, _("Gnome Ai Assistant"));

            this._extension = extension;
            this._settingsManager = new SettingsManager(this._extension.settings);
            this._clipboard = this._extension.clipboard;

            // Load settings
            this._loadSettings();

            // Initialize UI elements
            this._initializeUI();

            // Set up keyboard shortcut
            this._bindShortcut();

            // Set up timeout handles
            this._timeoutResponse = null;
            this._timeoutFocusInputBox = null;
            // Initialize history
            this._history = [];
            this._loadHistory();
        }

        /**
         * Create new conversation button and set up new conversation button event handlers
         * @private
         */
        _addFooterNavigationButtons() {
            this._newConversationButton = new St.Button({
                style_class: "conversation-button",
                child: new St.Icon({icon_name: "window-new", style_class: "reset-icon"}),
            });

            this._newImageButton = new St.Button({
                style_class: "conversation-button",
                child: new St.Icon({icon_name: "video-display", style_class: "photo-icon"}),
            })

            this._newImageButton
                .connect("clicked", () => this._handleSendScreenshot());
            this._newConversationButton
                .connect("clicked", () => this._handleNewConversation());
            this._newConversationButton
                .connect("enter-event", () => this._handleNewConversationEnter());
            this._newConversationButton
                .connect("leave-event", () => this._handleNewConversationLeave());

            this._bottomBox = new St.BoxLayout({vertical: false, style_class: CSS.BOTTOM_PANEL_BOX})
            this._bottomBox.add_child(this._newConversationButton);
            this._bottomBox.add_child(this._newImageButton)
        }

        _initializeUI() {

            // Add LeftPanel
            this._actor = new St.BoxLayout({
                style_class: 'right-panel',
                name: 'rightPanel',
                reactive: false,
                vertical: true
            });

            this._actor._delegate = this;

            // Create chat container
            this._chatBox = new St.BoxLayout({
                vertical: true,
                style_class: CSS.POPUP_MENU_BOX,
                style: "text-wrap: wrap",
            });

            // Create chat message display
            const styleSettings = this._settingsManager.getStyleSettings();

            this._chatDisplay = new ChatMessageDisplay(
                this._chatBox,
                styleSettings,
                () => this._extension.openSettings()
            );

            this._chatDisplay.setClipboard(this._clipboard);

            // Create chat input
            this._chatInput = new St.Entry({
                hint_text: UI.CHAT_INPUT_PLACEHOLDER,
                can_focus: true,
                track_hover: true,
                style_class: CSS.MESSAGE_INPUT,
            });

            this._chatDisplay.setChatInput(this._chatInput);

            // Set up input event handler
            this._chatInput
                .clutter_text
                .connect("activate", () => this._handleUserInput());

            this._addFooterNavigationButtons()

            // Create bottom input area
            const entryBox = new St.BoxLayout({
                vertical: false,
                style_class: CSS.POPUP_MENU_BOX,
            });

            entryBox.add_child(this._chatInput);

            // Create scrollable chat view
            this._chatView = new St.ScrollView({
                enable_mouse_scrolling: true,
                style_class: CSS.CHAT_SCROLLING,
                reactive: true,
            });

            this._chatView.set_child(this._chatBox);

            // Create main layout
            const layout = new St.BoxLayout({
                vertical: true,
                style_class: CSS.POPUP_MENU_BOX,
            });

            this._actor.add_child(this._chatView)
            this._actor.add_child(entryBox)
            this._actor.add_child(this._bottomBox)

            // layout.add_child(this._chatView);
            // layout.add_child(entryBox);

            this._initializePopupMenuUI(layout)

            this.menu.connect("open-state-changed", (self, open) => {
                if (open) {
                    this._focusInputBox();
                }
            });

            Main.layoutManager.addChrome(this._actor, {
                affectsStruts: true,
                trackFullscreen: false
            });

            Main.layoutManager.uiGroup.set_child_below_sibling(
                this._actor, Main.layoutManager.modalDialogGroup
            );

            this._initializeButtonUI()
            this._initializeContextMenuUI()
        }

        /**
         * Add to popup menu and setup menu open/close handler
         * @private
         */
        _initializePopupMenuUI(layout) {
            const popUp = new PopupMenu.PopupMenuSection();
            popUp.actor.add_child(layout);
            this.menu.addMenuItem(popUp);
        }

        /**
         * Add context menu, quit and restart options
         * @private
         */
        _initializeContextMenuUI() {
            this.menu = new PopupMenu.PopupMenu(this.button, 0.0, St.Side.TOP, 0);
            this.menu.actor.add_style_class_name('panel-status-menu-box');
            Main.layoutManager.addChrome(this.menu.actor);
            this.menu.actor.hide();

            let menuRestart = new PopupMenu
                .PopupMenuItem("Restart");

            let menuQuit = new PopupMenu
                .PopupMenuItem("Quit");

            this.menu.addMenuItem(menuRestart);
            this.menu.addMenuItem(menuQuit);

            if (!this.button.get_parent()) {
                Main.panel._rightBox.insert_child_at_index(this.button, 0);
            }
        }

        _initializeButtonUI() {
            // Add button
            this.button = new St.Bin({
                style_class: 'panel-button',
                reactive: true,
                can_focus: false,
                x_expand: true,
                y_expand: false,
                track_hover: true
            })

            this.button.add_child(new St.Icon({style_class: "icon"}));
            this.button.connect('button-press-event', (actor, event) => {
                switch (event.get_button()) {
                    case(1):
                        isPanelHidden = !isPanelHidden;
                        this._resetLayout()
                        // Toggle GTK Window
                        // this._toggleWindow(params.path);
                        break;
                    case(3):
                        this._toggleMenu();
                        break;
                }
            })
        }

        _toggleMenu() {
            this.menu.isOpen ? this.menu.close() : this.menu.open();
        }

        /**
         * Handle user message input
         * @private
         */
        _handleUserInput() {
            if (this._timeoutResponse) {
                GLib.Source.remove(this._timeoutResponse);
                this._timeoutResponse = null;
            }

            const input = this._chatInput.get_text();
            if (!input || input === UI.THINKING_TEXT) {
                return;
            }

            // Display user message
            this._chatDisplay.displayMessage(MessageRoles.USER, input);

            // Add to history
            this._history.push({
                role: MessageRoles.USER,
                content: input,
            });

            // Send to LLM
            this._sendToLLM();

            // Disable input during processing
            this._chatInput.set_reactive(false);
            this._chatInput.set_text(UI.THINKING_TEXT);
        }

        /**
         * Load settings and connect to changes
         * @private
         */
        _loadSettings() {
            this._settingsManager.connectToChanges(() => {
                this._chatDisplay.updateStyleSettings(this._settingsManager.getStyleSettings());
            });
        }

        /**
         * Handle new conversation button click
         * @private
         */
        _handleNewConversation() {
            if (this._chatInput.get_text() === UI.NEW_CONVERSATION_TEXT ||
                this._chatInput.get_text() !== UI.THINKING_TEXT) {
                /* Clear all history */
                this._history = [];
                this._settingsManager.setHistory([]);
                this._chatDisplay.clear();
            } else {
                this._chatDisplay.displayMessage(
                    MessageRoles.ASSISTANT,
                    "You can't create a new conversation while I am thinking"
                );
            }
        }

        /**
         *
         * @returns {Promise<void>}
         * @private
         */
        async _handleSendScreenshot() {
            if (this._timeoutResponse) {
                GLib.Source.remove(this._timeoutResponse);
                this._timeoutResponse = null;
            }

            let bytes = null,
                base64Image = null;

            try {
                const shooter = new Shell.Screenshot();
                const [content] = await shooter.screenshot_stage_to_content();
                const texture = content.get_texture();
                const geometry = [0, 0, 1920 - 350, 1080];

                bytes = await captureScreenshot(texture, geometry);

                base64Image = GLib.base64_encode(bytes.get_data())

            } catch (e) {
                logError(e, 'Error capturing screenshot');
            }

            const input = this._chatInput.get_text();
            if (!base64Image || !input || input === UI.THINKING_TEXT) {
                return;
            }

            this._chatDisplay.displayMessage(MessageRoles.USER, input);

            // Add to history
            this._history.push({
                role: MessageRoles.USER,
                content: [
                    {type: "text", text: input},
                    {
                        type: "image_url",
                        image_url: {
                            url: "data:image/png;base64," + base64Image
                        }
                    }
                ],
            });

            // Send to LLM
            this._sendToLLM();

            // Disable input during processing
            this._chatInput.set_reactive(false);
            this._chatInput.set_text(UI.THINKING_TEXT);
        }

        /**
         * Handle mouse enter on new conversation button
         * @private
         */
        _handleNewConversationEnter() {
            showTooltip("New");
        }

        /**
         * Handle mouse leave on new conversation button
         * @private
         */
        _handleNewConversationLeave() {
            hideTooltip();
        }

        _resetLayout() {
            let bottom = Main.layoutManager.bottomMonitor;
            let actorWidth = this._actor
                .get_theme_node()
                .get_width();

            let width = 350;
            if (isPanelHidden) {
                width = -width;
            }

            let marginTop = 40;

            this._actor.set_position(
                bottom.x + bottom.width - width,
                bottom.y + marginTop
            );

            this._actor.set_size(width, bottom.height);
        }

        /**
         * Send the current conversation to the LLM
         * @private
         */
        _sendToLLM() {
            const provider = this._settingsManager.getLLMProvider();
            const apiKey = this._settingsManager.getApiKey(provider);
            const model = this._settingsManager.getModel(provider);

            const llmProvider = LLMProviderFactory
                .createProvider(provider, apiKey, model);

            llmProvider.sendRequest(this._history, (error, response) => {
                if (error) {
                    let errorMessage = (
                        error.message &&
                        error.message.includes('HTTP error')
                    ) ?
                        formatString(UI.ERROR_API_KEY, provider) :
                        formatString(UI.ERROR_GENERIC, error.toString());

                    this._chatDisplay.displayError(errorMessage, true);
                    logError(error);

                } else {
                    // Display the response
                    this._chatDisplay.displayMessage(MessageRoles.ASSISTANT, response);
                    // Add to history
                    this._history.push({role: MessageRoles.ASSISTANT, content: response});
                    // Save updated history
                    this._settingsManager.setHistory(this._history);
                }

                // Re-enable input
                this._chatInput.set_reactive(true);
                this._chatInput.set_text("");
                this._focusInputBox();
            });
        }

        /**
         * Load chat history
         * @private
         */
        _loadHistory() {
            this._chatInput.set_reactive(false);
            this._chatInput.set_text(UI.LOADING_HISTORY);

            this._history = this._settingsManager.getHistory();
            this._chatDisplay.loadHistory(this._history);

            this._chatInput.set_reactive(true);
            this._chatInput.set_text("");
            this._focusInputBox();
        }

        /**
         * Set up keyboard shortcut
         * @private
         */
        _bindShortcut() {
            const shortcut = this._settingsManager
                .getOpenChatShortcut();

            setupShortcut(
                'open-chat-shortcut',
                shortcut,
                this._extension.settings,
                this._toggleChatWindow.bind(this)
            );

            /*
            const modal = this._settingsManager.getDialogShortcut();
            setupShortcut(
                'open-dialog-shortcut',
                modal,
                this._extension.settings,
                this._showDialog.bind(this)
            )
            */
        }

        /**
         * Remove keyboard shortcut
         * @private
         */
        _unbindShortcut() {
            removeShortcut();
        }

        /**
         * Focus the input box after a short delay
         * @private
         */
        _focusInputBox() {
            if (this._timeoutFocusInputBox) {
                GLib.Source.remove(this._timeoutFocusInputBox);
            }

            this._timeoutFocusInputBox = focusInput(this._chatInput);
        }

        /**
         * Toggle the chat window open/closed
         * @private
         */
        _toggleChatWindow() {
            if (this.menu.isOpen) {
                this.menu.close();
            } else {
                this.menu.open();
                this._focusInputBox();
            }
        }

        /**
         * Open extension settings
         * @private
         */
        _openSettings() {
            this._extension.openPreferences();
        }

        /**
         * Destroy method
         * @private
         */
        destroy() {
            if (this._timeoutResponse) {
                GLib.Source.remove(this._timeoutResponse);
                this._timeoutResponse = null;
            }

            if (this._timeoutFocusInputBox) {
                GLib.Source.remove(this._timeoutFocusInputBox);
                this._timeoutFocusInputBox = null;
            }

            this._unbindShortcut();
            this._settingsManager.disconnectAll();
            this._chatDisplay.destroy();
            hideTooltip();

            super.destroy();
        }
    })


/**
 * Extension entry point class
 */
export default class GnomeAssistantExtension extends Extension {
    enable() {
        this._rightPanel = new RightPanel({
            settings: this.getSettings(),
            openSettings: this.openPreferences,
            clipboard: St.Clipboard.get_default(),
            uuid: this.uuid,
        });

        //Main.panel.addToStatusArea(this.uuid, this._rightPanel);
        this._rightPanel._resetLayout();
    }

    disable() {
        this._rightPanel.destroy();
        this._rightPanel = null;
    }
}