import { Plugin, parseFrontMatterAliases, Notice, TFile, TFolder } from "obsidian";
import { oBridgeSettings, oBridgeSettingTab, DEFAULT_SETTINGS } from "./settings";
import { isExcludedFile, isExcludedDir, excludeFile, excludeDir } from "./utils"; 

export default class oBridge extends Plugin {
    settings: oBridgeSettings;

    async onload() {
        await this.loadSettings();

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file) => {
                // Add new menu item for "Excluded from Bridge"
                menu.addItem((item) => {
                    item
                        .setTitle("Exclude from oBridge")
                        .setIcon("no-link")
                        .onClick(async () => {
                            if (file instanceof TFile) {
                                if (excludeFile(file.basename)) {
                                    new Notice(`Excluded ${file.basename} from oBridge.`);
                                } else {
                                    new Notice(`File: ${file.basename} is already excluded from oBridge.`);
                                }
                            } else if (file instanceof TFolder) {
                                if (excludeDir(file.path)) {
                                    new Notice(`Excluded ${file.path} from oBridge.`);
                                } else {
                                    new Notice(`Directory: ${file.path} is already excluded from oBridge.`);
                                }
                            }
                        });
                });
            })
        );

        // Register another example event for 'editor-menu'
        this.registerEvent(
            this.app.workspace.on("editor-menu", (menu, editor, view) => {
                menu.addItem((item) => {
                    item
                        .setTitle("Exclude file from oBridge")
                        .setIcon("document")
                        .onClick(async () => {
                            const file = view.file;
                            if (file instanceof TFile) {
                                if (excludeFile(file.basename)) {
                                    new Notice(`Excluded ${file.basename} from oBridge.`);
                                } else {
                                    new Notice(`${file.basename} is already excluded from oBridge.`);
                                }
                            }
                        });
                });
            })
        );

        // Add Ribbon Icon
        this.addRibbonIcon("equal", "oBridge Files", async () => {
            try {
                const tree = await this.scanVault();
                console.log(tree);
                await this.createLinksFromScan();
            } catch (err) {
                console.error("Error scanning vault:", err);
            }
        });    

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


        this.addSettingTab(new oBridgeSettingTab(this.app, this));

        this.registerDomEvent(document, "click", (evt: MouseEvent) => {
            console.log("click", evt);
        });

        this.registerInterval(window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000));
    }


    async scanVault(): Promise<Bridge[]> {
        const results: Bridge[] = [];

        const files = this.app.vault.getMarkdownFiles();

        for (const entity of files) {
            // Check if the file is excluded
            if (entity instanceof TFile && isExcludedFile(entity.basename)) {
                continue;
            }

            // Check if the file is in an excluded directory
            if (entity instanceof TFolder && isExcludedDir(entity.path)) {
                continue;
            }


            const cache = this.app.metadataCache.getFileCache(entity);

            if (cache && cache.frontmatter) {
                const aliases = parseFrontMatterAliases(cache.frontmatter) || [];

                results.push({
                    fileName: entity.basename,
                    fullFilePath: entity.path,
                    data: {
                        aliases
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
            if (isExcludedFile(fileName)) {
                continue;
            }

            // Check if the current file is in one of the excluded directories
            if (isExcludedDir(fullFilePath)) {
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
            if (isExcludedFile(file.basename)) {
                continue;
            }

            let fileContent = await this.app.vault.read(file);
            let frontMatterEndIndex = fileContent.indexOf("---", 3);
            let contentWithoutFrontMatter = frontMatterEndIndex >= 0 ? fileContent.slice(frontMatterEndIndex + 3) : fileContent;

            // Replace occurrences of each alias in the file content (excluding the front matter)
            for (const [alias, originName] of aliasMap.entries()) {
                if (!this.settings.addAliasToSelf && file.basename === originName) {
                    // Don't replace the alias if it's the same as the file name
                    continue;
                }

                const regex = new RegExp(`(?<!\\[|\\|)\\b${alias}\\b(?!\\[|\\|)`, 'g')

                // If the alias is the same as the filename, don't use the alias in the replacement
                const replacement = alias === originName ? `[[${originName}]]` : `[[${originName}|${alias}]]`;
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
        aliases: string[]
    };
}
