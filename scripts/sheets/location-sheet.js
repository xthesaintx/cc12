import { CampaignCodexBaseSheet } from "./base-sheet.js";
import { TemplateComponents } from "./template-components.js";
import { CampaignCodexLinkers } from "./linkers.js";
import { promptForName, localize, format } from "../helper.js";

export class LocationSheet extends CampaignCodexBaseSheet {
  // =========================================================================
  // Foundry VTT Overrides
  // =========================================================================

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [...super.defaultOptions.classes, "location-sheet"],
    });
  }

  get template() {
    return "modules/campaign-codex/templates/base-sheet.html";
  }

  async getData() {
    const data = await super.getData();
    const locationData = this.document.getFlag("campaign-codex", "data") || {};

    // --- Basic Sheet Info ---
    data.sheetType = "location";
    data.sheetTypeLabel = localize("names.location");
    data.customImage = this.document.getFlag("campaign-codex", "image") || TemplateComponents.getAsset("image", "location");

    // --- Linked Data Fetching ---
    data.linkedRegion = await CampaignCodexLinkers.getLinkedRegion(this.document);
    data.directNPCs = await CampaignCodexLinkers.getDirectNPCs(this.document, locationData.linkedNPCs || []);
    data.shopNPCs = await CampaignCodexLinkers.getShopNPCs(this.document, locationData.linkedShops || []);
    data.linkedShops = await CampaignCodexLinkers.getLinkedShops(this.document, locationData.linkedShops || []);
    data.allNPCs = [...data.directNPCs, ...data.shopNPCs];
    data.taggedDirectNPCs = data.directNPCs.filter((npc) => npc.tag === true);
    data.taggedShopNPCs = data.shopNPCs.filter((npc) => npc.tag === true);
    data.taggedNPCs = data.allNPCs.filter((npc) => npc.tag === true);
    data.directNPCsWithoutTaggedNPCs = data.directNPCs.filter((npc) => npc.tag !== true);
    data.shopNPCsWithoutTaggedNPCs = data.shopNPCs.filter((npc) => npc.tag !== true);
    data.allNPCsWithoutTaggedNPCs = [...data.directNPCsWithoutTaggedNPCs, ...data.shopNPCsWithoutTaggedNPCs];

    const directUuids = new Set(data.directNPCsWithoutTaggedNPCs.map((npc) => npc.uuid));
    data.shopNPCsWithoutTaggedNPCsNoDirect = data.shopNPCsWithoutTaggedNPCs.filter((associate) => !directUuids.has(associate.uuid));

    // Linked Scene
    data.linkedScene = null;
    if (locationData.linkedScene) {
      try {
        const scene = await fromUuid(locationData.linkedScene);
        if (scene) {
          data.linkedScene = {
            uuid: scene.uuid,
            name: scene.name,
            img: scene.thumb || "icons/svg/map.svg",
          };
        }
      } catch (error) {
        console.warn(`Campaign Codex | Linked scene not found: ${locationData.linkedScene}`);
      }
    }

    // --- Permissions ---
    data.canViewRegion = await this.constructor.canUserView(data.linkedRegion?.uuid);
    data.canViewScene = await this.constructor.canUserView(data.linkedScene?.uuid);

    // --- UI Component Data ---
    data.tabs = [
      { key: "info", label: localize("names.info"), icon: "fas fa-info-circle" },
      {
        key: "npcs",
        label: localize("names.npcs"),
        icon: "fas fa-users",
        statistic: { value: data.directNPCsWithoutTaggedNPCs.length + data.shopNPCsWithoutTaggedNPCsNoDirect.length + data.taggedDirectNPCs.length, color: "#fd7e14" },
      },
      { key: "shops", label: localize("names.shops"), icon: "fas fa-book-open", statistic: { value: data.linkedShops.length, color: "#6f42c1" } },
      ...(data.isGM ? [{ key: "notes", label: localize("names.note"), icon: "fas fa-sticky-note" }] : []),
    ].map((tab) => ({ ...tab, active: this._currentTab === tab.key }));

    data.quickLinks = CampaignCodexLinkers.createQuickLinks([
      { data: data.allNPCsWithoutTaggedNPCs, type: "npc" },
      { data: data.linkedShops, type: "shop" },
    ]);
    data.quickTags = CampaignCodexLinkers.createQuickTags(data.taggedDirectNPCs);

    // --- Custom Header ---
    let headerContent = "";
    if (data.linkedRegion) {
      headerContent += `<div class="region-info"><span class="region-label">${localize('names.region')}:</span> <span class="region-name ${data.canViewRegion ? `region-link" data-region-uuid="${data.linkedRegion.uuid}"` : '"'}">${data.linkedRegion.name}</span></div>`;
    }
    if (data.linkedScene) {
      headerContent += `<div class="scene-info"><span class="scene-name ${data.canViewScene ? `open-scene" data-scene-uuid="${data.linkedScene.uuid}"` : '"'} title="Open Scene"><i class="fas fa-map"></i> ${data.linkedScene.name}</span>${data.isGM ? `<button type="button" class="scene-btn remove-scene" title="Unlink Scene"><i class="fas fa-unlink"></i></button>` : ""}</div>`;
    } else if (data.isGM) {
      headerContent += `<div class="scene-info"><span class="scene-name open-scene"><i class="fas fa-link"></i> ${format('dropzone.link', {type:localize('names.scene')})}</span></div>`;
    }
    if (headerContent) data.customHeaderContent = headerContent;

    // --- Tab Panels ---
    data.tabPanels = [
      { key: "info", active: this._currentTab === "info", content: this._generateInfoTab(data) },
      { key: "npcs", active: this._currentTab === "npcs", content: await this._generateNPCsTab(data) },
      { key: "shops", active: this._currentTab === "shops", content: await this._generateShopsTab(data) },
      { key: "notes", active: this._currentTab === "notes", content: CampaignCodexBaseSheet.generateNotesTab(this.document, data) },
    ];

    return data;
  }

  _activateSheetSpecificListeners(html) {
  const nativeHtml = html instanceof jQuery ? html[0] : html;

  // --- Listeners for single, non-repeating elements ---
  const singleActionMap = {
    ".create-npc-button": this._onCreateNPCJournal,
    ".create-shop-button": this._onCreateShopJournal,
    ".remove-location": this._onRemoveFromRegion,
    ".open-scene": this._onOpenScene,
    ".remove-scene": this._onRemoveScene,
    ".refresh-npcs": this._onRefreshNPCs,
  };

  for (const [selector, handler] of Object.entries(singleActionMap)) {
    nativeHtml.querySelector(selector)?.addEventListener("click", handler.bind(this));
  }

  // --- Listeners for opening different document types ---
  const documentOpenMap = {
    ".open-npc, .npc-link": { flag: "npc", handler: this._onOpenDocument },
    ".open-shop, .shop-link": { flag: "shop", handler: this._onOpenDocument },
    ".open-actor": { flag: "actor", handler: this._onOpenDocument },
    ".open-region, .region-link": { flag: "region", handler: this._onOpenDocument },
  };

  for (const [selector, { flag, handler }] of Object.entries(documentOpenMap)) {
    nativeHtml.querySelectorAll(selector).forEach((el) => {
      el.addEventListener("click", (e) => handler.call(this, e, flag));
    });
  }

  // --- Listeners for actions on lists that require a flag ---
  const listActionMap = {
    ".remove-npc": { flag: "linkedNPCs", handler: this._onRemoveFromList },
    ".remove-shop": { flag: "linkedShops", handler: this._onRemoveFromList },
  };

  for (const [selector, { flag, handler }] of Object.entries(listActionMap)) {
    nativeHtml.querySelectorAll(selector).forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        await handler.call(this, e, flag);
      });
    });
  }
  }

  async _handleDrop(data, event) {
    if (data.type === "Scene") {
      await this._handleSceneDrop(data, event);
    } else if (data.type === "JournalEntry" || data.type === "JournalEntryPage") {
      await this._handleJournalDrop(data, event);
    } else if (data.type === "Actor") {
      await this._handleActorDrop(data, event);
    }
  }

  getSheetType() {
    return "location";
  }

  // =========================================================================
  // Tab Generation
  // =========================================================================

  _generateInfoTab(data) {
    const standardJournalSection = TemplateComponents.standardJournalSection(data);
    let regionSection = "";

    if (data.linkedRegion) {
      const regionCard = `
        <div class="linked-actor-card">
          <div class="actor-image"><img src="${data.linkedRegion.img}" alt="${data.linkedRegion.name}"></div>
          <div class="actor-content"><h4 class="actor-name">${data.linkedRegion.name}</h4></div>
          <div class="actor-actions">
            ${data.canViewRegion ? `<button type="button" class="action-btn open-region" data-region-uuid="${data.linkedRegion.uuid}" title="Open Region"><i class="fas fa-external-link-alt"></i></button>` : ""}
            ${data.isGM ? `<button type="button" class="action-btn remove-location" title="Remove from Region"><i class="fas fa-unlink"></i></button>` : ""}
          </div>
        </div>
      `;
      regionSection = `<div class="form-section">${regionCard}</div>`;
    } else if (data.isGM) {
      regionSection = `<div class="form-section">${TemplateComponents.dropZone("region", "fas fa-globe", format("dropzone.link", { type: localize("names.region") }), "")}</div>`;
    }
    return `
      ${TemplateComponents.contentHeader("fas fa-info-circle", "Information")}
      ${regionSection}
      ${standardJournalSection}
      ${TemplateComponents.richTextSection(this.document, data.sheetData.enrichedDescription, "description", data.isOwnerOrHigher)}
    `;
  }

  async _generateNPCsTab(data) {
    const preparedDirectNPCs = data.directNPCsWithoutTaggedNPCs;
    const preparedShopNPCs = data.shopNPCsWithoutTaggedNPCsNoDirect;
    const preparedtaggedNPCs = data.taggedDirectNPCs;

    let buttons = "";
    if (data.isGM) {
      if (canvas.scene && data.directNPCs.length > 0) {
        buttons += `<button type="button" class="refresh-btn npcs-to-map-button" title="${format("button.droptoscene", { type: localize("names.npc") })}"><i class="fas fa-street-view"></i>
        </button>`;
      }
      buttons += `<button type="button" class="refresh-btn create-npc-button" title="${format('button.title', {type:localize('names.npc')})}"><i class="fas fa-user-plus"></i></button>`;
    }

    let content = TemplateComponents.contentHeader("fas fa-users", localize("names.npcs"), buttons);
    if (data.isGM) {
      content += TemplateComponents.dropZone("npc", "fas fa-user-plus", "", "");
    }

    if (preparedDirectNPCs.length > 0) {
      content += `<div class="npc-section">${TemplateComponents.entityGrid(preparedDirectNPCs, "npc", true)}</div>`;
    }

    if (preparedShopNPCs.length > 0) {
      content += `<div class="npc-section"><h3><i class="${TemplateComponents.getAsset("icon", "shop")}"></i> ${format("heading.in", { type: localize("names.shop"), in: localize("names.npcs") })}</h3>${TemplateComponents.entityGrid(preparedShopNPCs, "npc", true, true)}</div>`;
    }

    if (data.allNPCs.length === 0) {
      content += TemplateComponents.emptyState("npc");
    }
    return content;
  }

  async _generateShopsTab(data) {
    const createShopBtn = data.isGM
      ? `<button type="button" class="refresh-btn create-shop-button" title="${format('button.title', {type:localize('names.shop')})}"><i class="fas fa-house-chimney-medical"></i></button>`
      : "";
    const preparedShops = data.linkedShops;
    return `
      ${TemplateComponents.contentHeader("fas fa-book-open", localize('names.shops'), createShopBtn)}
      ${data.isGM ? TemplateComponents.dropZone("shop", "fas fa-book-open", "Add Entries", "Drag entry journals here to link them") : ""}
      ${TemplateComponents.entityGrid(preparedShops, "shop")}
    `;
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  async _onCreateShopJournal(event) {
    event.preventDefault();
    const name = await promptForName("Entry");
    if (name) {
      const shopJournal = await game.campaignCodex.createShopJournal(name);
      if (shopJournal) {
        await game.campaignCodex.linkLocationToShop(this.document, shopJournal);
        this.render(false);
        shopJournal.sheet.render(true);
      }
    }
  }

  async _onCreateNPCJournal(event) {
    event.preventDefault();
    const name = await promptForName("NPC");
    if (name) {
      const npcJournal = await game.campaignCodex.createNPCJournal(null, name);
      if (npcJournal) {
        await game.campaignCodex.linkLocationToNPC(this.document, npcJournal);
        this.render(false);
        npcJournal.sheet.render(true);
      }
    }
  }

  async _onRefreshNPCs(event) {
    this.render(false);
    ui.notifications.info("Location data refreshed!");
  }

  async _onOpenScene(event) {
    event.preventDefault();
    await game.campaignCodex.openLinkedScene(this.document);
  }

  async _onRemoveScene(event) {
    event.preventDefault();
    await this._saveFormData();
    await this.document.setFlag("campaign-codex", "data", { ...this.document.getFlag("campaign-codex", "data"), linkedScene: null });
    this.render(false);
    ui.notifications.info("Unlinked scene");
  }

  async _onDropNPCsToMapClick(event) {
    event.preventDefault();
    const locationData = this.document.getFlag("campaign-codex", "data") || {};
    const rawDirectNPCs = await CampaignCodexLinkers.getDirectNPCs(this.document, locationData.linkedNPCs || []);
    const directNPCs = rawDirectNPCs.filter((npc) => npc.tag !== true);

    if (directNPCs?.length > 0) {
      await this._onDropNPCsToMap(directNPCs, { title: format ('message.droptomap', {type: this.document.name}) });
    } else {
      ui.notifications.warn(localize("warn.invaliddrop"));
    }
  }


  // =========================================================================
  // Drop Logic
  // =========================================================================

  async _handleSceneDrop(data, event) {
    const scene = await fromUuid(data.uuid);
    if (!scene) return ui.notifications.warn("Could not find the dropped scene.");
    await this._saveFormData();
    await game.campaignCodex.linkSceneToDocument(scene, this.document);
    ui.notifications.info(`Linked scene "${scene.name}" to ${this.document.name}`);
    this.render(false);
  }

  async _handleJournalDrop(data, event) {
    const journal = await fromUuid(data.uuid);
    if (!journal || journal.uuid === this.document.uuid) return;

    const journalType = journal.getFlag("campaign-codex", "type");
    const dropOnInfoTab = event.target.closest('.tab-panel[data-tab="info"]');

    await this._saveFormData();

    if (((!journalType && data.type === "JournalEntry") || data.type === "JournalEntryPage") && dropOnInfoTab) {
      // Handle standard journal drop on info tab
      const locationData = this.document.getFlag("campaign-codex", "data") || {};
      locationData.linkedStandardJournal = journal.uuid;
      await this.document.setFlag("campaign-codex", "data", locationData);
      ui.notifications.info(`Linked journal "${journal.name}".`);
    } else if (journalType === "npc") {
      await game.campaignCodex.linkLocationToNPC(this.document, journal);
    } else if (journalType === "shop") {
      await game.campaignCodex.linkLocationToShop(this.document, journal);
    } else if (journalType === "region") {
      await game.campaignCodex.linkRegionToLocation(journal, this.document);
      ui.notifications.info(format('ui.addedto', {type:this.document.name,typeb:journal.name}));
    } else {
      return; 
    }
    this.render(false);
  }
}
