import { App, Plugin, PluginSettingTab, Setting, parseFrontMatterAliases, Notice, TFile, TFolder, Vault } from "obsidian";

export default class oBridged extends Plugin {
    settings: oBridgedSettings;

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: "scan-files",
            name: "Bridge Files in Vault",
            callback: async () => {
                try {
                    const tree = await this.scanVault();
                    console.log(tree);
                    await this.createLinksFromScan();
                } catch (err) {
                    console.error("Error scanning vault:", err);
                }
            },
        });

        this.addSettingTab(new oBridgedSettingTab(this.app, this));

        this.registerDomEvent(document, "click", (evt: MouseEvent) => {
            console.log("click", evt);
        });

        this.registerInterval(window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000));
    }

    async scanVault(): Promise<Bridge[]> {
        const results: Bridge[] = [];

        const files = this.app.vault.getMarkdownFiles();

        for (const file of files) {
            // Check if the current file is in one of the excluded directories
            if (this.settings.excludedDirs.some(dir => file.path.startsWith(dir))) {
                continue;
            }

            // Check if the current file is in the excludedFiles array
            if (this.settings.excludedFiles.includes(file.basename)) {
                continue;
            }

            const cache = this.app.metadataCache.getFileCache(file);

            if (cache && cache.frontmatter) {
                const aliases = parseFrontMatterAliases(cache.frontmatter) || [];

                results.push({
                    fileName: file.basename,
                    fullFilePath: file.path,
                    data: {
                        aliases,
                        mode: 0
                    }
                });
            }
        }

        new Notice("Scan complete!");

        await this.saveData(results);

        return results;
    }

    async createLinksFromScan() {
        // Load the data from the results file
        const results: Bridge[] = await this.loadData();

        // Create an alias map for all files
        const aliasMap = new Map<string, string>();
        for (const result of results) {
            const fileName = result.fileName;
            const fullFilePath = result.fullFilePath;
            const aliases = result.data.aliases;

            // Check if the current file is in the excludedFiles array
            if (this.settings.excludedFiles.includes(fileName)) {
                continue;
            }

            // Check if the current file is in one of the excluded directories
            if (this.settings.excludedDirs.some(dir => fullFilePath.startsWith(dir))) {
                continue;
            }

            aliases.forEach(alias => aliasMap.set(alias, fileName));
            // Include the file name as an alias for itself
            aliasMap.set(fileName, fileName);
        }

        // Get all files in the vault
        const allFiles = this.app.vault.getMarkdownFiles();

        let bridgesAdded = 0; // Add a counter for the links added

        // Iterate over each file
        for (const file of allFiles) {
            if (!(file instanceof TFile)) {
                continue;
            }

            // Check if the current file is in the excludedFiles array
            if (this.settings.excludedFiles.includes(file.basename)) {
                continue;
            }

            let fileContent = await this.app.vault.read(file);
            let frontMatterEndIndex = fileContent.indexOf("---", 3);
            let contentWithoutFrontMatter = frontMatterEndIndex >= 0 ? fileContent.slice(frontMatterEndIndex + 3) : fileContent;

            // Replace occurrences of each alias in the file content (excluding the front matter)
            for (const [alias, fileName] of aliasMap.entries()) {
                if (alias === fileName) { // TODO: Make this a setting
                    // Don't replace the alias if it's the same as the file name
                    continue;
                }

                const regex = new RegExp(`(?<!\\[|\\|)\\b${alias}\\b(?!\\[|\\|)`, 'g')
                // If the alias is the same as the filename, don't use the alias in the replacement
                const replacement = alias === fileName ? `[[${fileName}]]` : `[[${fileName}|${alias}]]`;
                const newContentWithoutFrontMatter = contentWithoutFrontMatter.replace(regex, replacement);

                if (newContentWithoutFrontMatter !== contentWithoutFrontMatter) {
                    bridgesAdded++; // Increment the counter each time a link is added
                    fileContent = frontMatterEndIndex >= 0 ? fileContent.slice(0, frontMatterEndIndex + 3) + newContentWithoutFrontMatter : newContentWithoutFrontMatter;
                    await this.app.vault.modify(file, fileContent);

                    fileContent = await this.app.vault.read(file);
                    frontMatterEndIndex = fileContent.indexOf("---", 3);
                    contentWithoutFrontMatter = frontMatterEndIndex >= 0 ? fileContent.slice(frontMatterEndIndex + 3) : fileContent;
                }
            }
        }

        new Notice(`Bridging complete! ${bridgesAdded} links added.`); // Display a notice with the number of links added
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}


interface Bridge {
    fileName: string;
    fullFilePath: string;
    data: {
        aliases: string[];
        mode: number
    };
}

interface oBridgedSettings {
    mySetting: string;
    excludedFiles: string[];
    excludedDirs: string[];
}

const DEFAULT_SETTINGS: oBridgedSettings = {
    mySetting: "notes",
    excludedFiles: [],
    excludedDirs: []
};


class oBridgedSettingTab extends PluginSettingTab {
    plugin: oBridged;

    constructor(app: App, plugin: oBridged) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Exclude Files")
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

