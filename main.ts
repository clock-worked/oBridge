import { App, Plugin, PluginSettingTab, Setting, parseFrontMatterAliases, Notice, TFile } from "obsidian";

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
                    await this.findBridgesForFile();
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

    async scanVault(): Promise<any[]> {
        const results: any[] = [];
    
        const files = this.app.vault.getMarkdownFiles();
    
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
    
            if (cache && cache.frontmatter) {
                const aliases = parseFrontMatterAliases(cache.frontmatter);
                const modes = aliases ? new Array(aliases.length).fill(0) : [];
    
                results.push({
                    fileName: file.basename,
                    data: {
                        aliases,
                        modes
                    }
                });
            }
        }
    
        new Notice("Scan complete!");
    
        await this.saveData(results);
        
        return results;
    }

    async findBridgesForFile() {
		const results = await this.loadData();
	
		for (const result of results) {
			const fileName = result.fileName;
			const fileAliases = result.data.aliases;
	
			const file = this.app.vault.getAbstractFileByPath(fileName);
			if (!(file instanceof TFile)) {
				continue;
			}
	
			let fileContent = await this.app.vault.read(file);
	
			for (const alias of fileAliases) {
				const regex = new RegExp(`\\b${alias}\\b`, 'g');
				if (alias === fileName) {
					fileContent = fileContent.replace(regex, `[[${fileName}]]`);
				} else {
					fileContent = fileContent.replace(regex, `[[${fileName}|${alias}]]`);
				}
			}
	
			await this.app.vault.modify(file, fileContent);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

interface oBridgedSettings {
	mySetting: string;
	excludedFiles: string[];
}

const DEFAULT_SETTINGS: oBridgedSettings = {
	mySetting: "notes",
	excludedFiles: []
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
    }
}