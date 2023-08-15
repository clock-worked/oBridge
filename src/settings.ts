
import { App, PluginSettingTab, Setting, parseFrontMatterAliases, Vault, TFolder } from 'obsidian';

import oBridge from './main';


export interface oBridgeSettings {
    mySetting: string;
    excludedFiles: string[];
    excludedDirs: string[];
    addAliasToSelf: boolean;
}

export const DEFAULT_SETTINGS: oBridgeSettings = {
    mySetting: "notes",
    excludedFiles: [],
    excludedDirs: [],
    addAliasToSelf: false
};

export class oBridgeSettingTab extends PluginSettingTab {
    plugin: oBridge;

    constructor(app: App, plugin: oBridge) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        this.containerEl.createEl("h3", {
            text: "General Settings",
          });

        new Setting(containerEl)
            .setName("Enable Alias to Self")
            .setDesc("If enabled, the alias will be added to the file that reference itself.\n Ex: [[Note]] will add [[Note]] to the Note file.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addAliasToSelf)
                .onChange(async (value) => {
                    this.plugin.settings.addAliasToSelf = value;
                    await this.plugin.saveSettings();
                }));


        this.containerEl.createEl("h3", {
            text: "Exclude Settings",
            });

        new Setting(containerEl)
            .setName("Exclude File:")
            .setDesc("These files will be excluded from bridging")
            .addDropdown(dropdown => {
                const options: { [key: string]: string } = {};
                this.app.vault.getMarkdownFiles().forEach(file => {
                    options[file.basename] = file.basename;
                });
                dropdown.addOption("", "Choose file");
                dropdown.addOptions(options);
                dropdown.onChange(value => {
                    if (value) {
                        this.plugin.settings.excludedFiles.push(value);
                        this.plugin.saveSettings();
                        this.display();
                    }
                });
            });

        this.plugin.settings.excludedFiles.forEach((excludedFile, index) => {
            const file = this.app.vault.getMarkdownFiles().find(file => file.basename === excludedFile);

            if (!file) {
                return;
            }
            const cache = this.app.metadataCache.getFileCache(file);
            let aliases = cache && cache.frontmatter ? parseFrontMatterAliases(cache.frontmatter) : [];

            if (!aliases) {
                aliases = [];
            }

            new Setting(containerEl)
                .setName(`Excluded Note: ${file.basename}`)
                .setDesc(aliases.length > 0 ? `Aliases: ${aliases.join(', ')}` : 'No aliases assigned.')
                .addButton(button => button
                    .setButtonText('Remove')
                    .onClick(() => {
                        this.plugin.settings.excludedFiles.splice(index, 1);
                        this.plugin.saveSettings();
                        this.display();
                    }));
        });

        new Setting(containerEl)
            .setName("Exclude Directory")
            .setDesc("These directories will be excluded from bridging.")
            .addDropdown(dropdown => {
                const rootFolder = this.app.vault.getRoot();
                const options: { [key: string]: string } = {};

                Vault.recurseChildren(rootFolder, (file) => {
                    if (file instanceof TFolder) {
                        options[file.path] = file.name;
                    }
                });

                dropdown.addOption("", "Choose directory");
                dropdown.addOptions(options);

                dropdown.onChange(value => {
                    if (value) {
                        this.plugin.settings.excludedDirs.push(value);
                        this.plugin.saveSettings();
                        this.display();
                    }
                });
            });

        this.plugin.settings.excludedDirs.forEach((excludedDir, index) => {
            new Setting(containerEl)
                .setName(`Excluded Directory: ${excludedDir}`)
                .addButton(button => button
                    .setButtonText('Remove')
                    .onClick(() => {
                        this.plugin.settings.excludedDirs.splice(index, 1);
                        this.plugin.saveSettings();
                        this.display();
                    }));
        });
    }
}
