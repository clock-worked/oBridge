
import { App, PluginSettingTab, Setting, TFolder, Vault } from 'obsidian';
import { getAliasesForFile, getAliasesForDirectory, isExcludedDir, isExcludedFile } from './utils';
import oBridge from './main';



export interface excludedEntity {
    name: string,
    canLinkFromOutside: boolean,
    canBeLinked: boolean,
}

export const DEFAULT_EXCLUDED_ENTITY: excludedEntity = {
    name: '',
    canLinkFromOutside: false,
    canBeLinked: false,
}

export interface oBridgeSettings {
    mySetting: string;
    excludedFiles: excludedEntity[],
    excludedDirs: excludedEntity[],
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

        this.createGeneralSettings(containerEl);
        this.createExcludeSettings(containerEl);

        // TODO: Add setting to replace existing aliases with file name

        // TODO: Use first alias in list when bridging
    }

    private createGeneralSettings(containerEl: HTMLElement) {
        this.containerEl.createEl("h3", {
            text: "General Settings",
        });

        new Setting(containerEl)
            .setName("Enable Alias to Self")
            .setDesc("If enabled, the alias will be added to the file that reference itself.\n Ex: Note will add [[Note]] to the Note file.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addAliasToSelf)
                .onChange(async (value) => {
                    this.plugin.settings.addAliasToSelf = value;
                    await this.plugin.saveSettings();
                }));
    }

    private createExcludeSettings(containerEl: HTMLElement) {
        this.containerEl.createEl("h3", {
            text: "Exclude Files",
        });

        const excludedNotesEl = this.containerEl.createEl('div');

        new Setting(excludedNotesEl)
            .setName("File")
            .setDesc("These files will be excluded from bridging")
            .addDropdown(dropdown => {
                const options: { [key: string]: string } = {};
                this.app.vault.getMarkdownFiles().forEach(file => {
                    // Remove excluded files from dropdown
                    if (isExcludedFile(file.basename, this.plugin.settings.excludedFiles)) {
                        return;
                    }
                    options[file.basename] = file.basename;
                });
                dropdown.addOption("", "Choose file");
                dropdown.addOptions(options);
                dropdown.onChange(value => {
                    if (value) {
                        this.plugin.settings.excludedFiles.push({
                            name: value,
                            canLinkFromOutside: false,
                            canBeLinked: false,
                        });
                        this.display();
                    }
                });
            });

        this.plugin.settings.excludedFiles.forEach((excludedFile, index) => {
            const file = this.app.vault.getMarkdownFiles().find(file => file.basename === excludedFile.name);

            if (!file) {
                return;
            }

            const aliases = getAliasesForFile(file);

            const settingContainer = excludedNotesEl.createEl('div');
            settingContainer.style.display = 'flex';
            settingContainer.style.flexDirection = 'column';

            const settingDiv = settingContainer.createEl('div');
            settingDiv.style.flex = '1';

            const setting = new Setting(settingDiv)
                .setName(`- ${file.basename}`)
                .setDesc(aliases.length > 0 ? `Aliases: ${aliases.join(', ')}` : 'No aliases assigned.')
                .addToggle(toggle => {
                    toggle.setValue(false)
                    toggle.setTooltip("Show advanced options")
                    toggle.onChange(value => {
                        advancedOptionsEl.style.display = value ? 'block' : 'none';
                    })
                })


            const advancedOptionsEl = document.createElement('div');
            advancedOptionsEl.style.display = 'none';
            advancedOptionsEl.className = 'advanced-option';
            settingContainer.appendChild(advancedOptionsEl);

            setting.addButton(button => button
                .setButtonText('Remove')
                .onClick(() => {
                    this.plugin.settings.excludedFiles.splice(index, 1);
                    this.plugin.saveSettings();
                    this.display();
                }));

            this.prepareStylesForNestedSettings(advancedOptionsEl, 0);

            new Setting(this.prepareStylesForNestedSettings(advancedOptionsEl, 1))
                .setName("Bridge to External Content")
                .setDesc("When enabled, links will be created from this file's aliases to matching content outside of the file.")
                .addToggle(async toggle => {
                    toggle
                        .setValue(excludedFile.canLinkFromOutside ?? true)
                        .onChange(async (value: boolean) => {
                            excludedFile.canLinkFromOutside = value;
                            await this.plugin.saveSettings();
                        });
                }),


                new Setting(this.prepareStylesForNestedSettings(advancedOptionsEl, 1))
                    .setName("Bridge to Internal Content")
                    .setDesc("When enabled, links will be created in matching external content to this file's aliases.")
                    .addToggle(async toggle => {
                        toggle
                            .setValue(excludedFile.canBeLinked ?? true)
                            .onChange(async (value: boolean) => {
                                excludedFile.canBeLinked = value;
                                await this.plugin.saveSettings();
                            });
                    })
        });

        this.containerEl.createEl("h3", {
            text: "Exclude Directories",
        });

        const excludedDirsEl = this.containerEl.createEl('div');

        new Setting(excludedDirsEl)
            .setName("Directory")
            .setDesc("These directories will be excluded from bridging")
            .addDropdown(dropdown => {
                const rootFolder = this.app.vault.getRoot();
                const options: { [key: string]: string } = {};

                Vault.recurseChildren(rootFolder, (file) => {
                    if (!(file instanceof TFolder)) {
                        return;
                    } else if (file.name === '') {
                        return;
                    } else if (isExcludedDir(file.path, this.plugin.settings.excludedDirs)) {
                        return;
                    }

                    options[file.path] = file.name;
                });

                dropdown.addOption("", "Choose directory");
                dropdown.addOptions(options);

                dropdown.onChange(value => {
                    if (value) {
                        this.plugin.settings.excludedDirs.push({
                            name: value,
                            canLinkFromOutside: false,
                            canBeLinked: false,
                        });
                        this.display();
                    }
                });
            });

        this.plugin.settings.excludedDirs.forEach((excludedDir, index) => {
            const settingContainer = excludedDirsEl.createEl('div');
            settingContainer.style.display = 'flex';
            settingContainer.style.flexDirection = 'column';

            const settingDiv = settingContainer.createEl('div');
            settingDiv.style.flex = '1';

            // Create a string of filenames and aliases in the directory
            const aliases = getAliasesForDirectory(excludedDir.name);

            const setting = new Setting(settingDiv)
                .setName(`- ${excludedDir.name}`)
                .setDesc(aliases.length > 0 ? `Aliases: ${aliases.join(', ')}` : 'No aliases assigned.')
                .addToggle(async toggle => {
                    toggle
                        .setValue(false)
                        .setTooltip("Show advanced options")
                        .onChange(value => {
                            advancedOptionsEl.style.display = value ? 'block' : 'none';
                        })
                })


            const advancedOptionsEl = document.createElement('div');
            advancedOptionsEl.style.display = 'none';
            advancedOptionsEl.className = 'advanced-option';
            settingContainer.appendChild(advancedOptionsEl);

            setting.addButton(button => button
                .setButtonText('Remove')
                .onClick(() => {
                    this.plugin.settings.excludedDirs.splice(index, 1);
                    this.plugin.saveSettings();
                    this.display();
                }));

            this.prepareStylesForNestedSettings(advancedOptionsEl, 0);

            new Setting(this.prepareStylesForNestedSettings(advancedOptionsEl, 1))
                .setName("Bridge to External Content")
                .setDesc("When enabled, links will be created from this file's aliases to matching content outside of the file.")
                .addToggle(async toggle => {
                    toggle
                        .setValue(excludedDir.canLinkFromOutside ?? true)
                        .onChange(async (value: boolean) => {
                            excludedDir.canLinkFromOutside = value;
                            await this.plugin.saveSettings();
                        });
                }),

                new Setting(this.prepareStylesForNestedSettings(advancedOptionsEl, 1))
                    .setName("Bridge to Internal Content")
                    .setDesc("When enabled, links will be created in matching external aliases to this file's content.")
                    .addToggle(async toggle => {
                        toggle
                            .setValue(excludedDir.canBeLinked ?? true)
                            .onChange(async (value: boolean) => {
                                excludedDir.canBeLinked = value;
                                await this.plugin.saveSettings();
                            });
                    })
        });
    }
    // method for adjustment style through code
    protected prepareStylesForNestedSettings(containerEl: HTMLElement, indentLevel: number): HTMLElement {
        const div = containerEl.createDiv();
        div.style.marginLeft = `${2 * indentLevel}em`;
        return div;
    }
}
