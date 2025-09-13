import { localize, format } from "./helper.js";
import { CampaignCodexLinkers } from "./sheets/linkers.js";

export class CampaignManager {
  // =========================================================================
  // Initialization
  // =========================================================================

  constructor() {
    this.relationshipCache = new Map();
    this._creationQueue = new Set();
  }

  // =========================================================================
  // Document Creation
  // =========================================================================

  async createNPCJournal(actor = null, name = null) {
    const journalName = name || (actor ? `${actor.name} - Journal` : "New NPC Journal");
    const creationKey = `npc-${actor?.uuid || journalName}`;
    if (this._creationQueue.has(creationKey)) return;
    this._creationQueue.add(creationKey);

    try {
      const journalData = {
        name: journalName,
        flags: {
          "campaign-codex": {
            type: "npc",
            data: {
              linkedActor: actor ? actor.uuid : null,
              description: "",
              linkedLocations: [],
              linkedShops: [],
              associates: [],
              notes: "",
            },
          },
          core: { sheetClass: "campaign-codex.NPCSheet" },
        },
        pages: [{ name: "Overview", type: "text", text: { content: `<h1>${journalName}</h1><p>NPC details...</p>` } }],
      };
      return await JournalEntry.create(journalData);
    } finally {
      this._creationQueue.delete(creationKey);
    }
  }

  async createLocationJournal(name = "New Location") {
    const creationKey = `location-${name}`;
    if (this._creationQueue.has(creationKey)) return;
    this._creationQueue.add(creationKey);

    try {
      const journalData = {
        name: name,
        flags: {
          "campaign-codex": {
            type: "location",
            data: {
              description: "",
              linkedNPCs: [],
              linkedScene: null,
              linkedShops: [],
              notes: "",
            },
          },
          core: { sheetClass: "campaign-codex.LocationSheet" },
        },
        pages: [{ name: "Overview", type: "text", text: { content: `<h1>${name}</h1><p>Location overview...</p>` } }],
      };
      return await JournalEntry.create(journalData);
    } finally {
      this._creationQueue.delete(creationKey);
    }
  }

  async createShopJournal(name = "New Entry") {
    const creationKey = `shop-${name}`;
    if (this._creationQueue.has(creationKey)) return;
    this._creationQueue.add(creationKey);

    try {
      const journalData = {
        name: name,
        flags: {
          "campaign-codex": {
            type: "shop",
            data: {
              description: "",
              linkedNPCs: [],
              linkedLocation: null,
              inventory: [],
              linkedScene: null,
              markup: 1.0,
              notes: "",
            },
          },
          core: { sheetClass: "campaign-codex.ShopSheet" },
        },
        pages: [{ name: "Overview", type: "text", text: { content: `<h1>${name}</h1><p>Entry overview...</p>` } }],
      };
      return await JournalEntry.create(journalData);
    } finally {
      this._creationQueue.delete(creationKey);
    }
  }

  async createRegionJournal(name = "New Region") {
    const creationKey = `region-${name}`;
    if (this._creationQueue.has(creationKey)) return;
    this._creationQueue.add(creationKey);

    try {
      const journalData = {
        name: name,
        flags: {
          "campaign-codex": {
            type: "region",
            data: {
              description: "",
              linkedLocations: [],
              linkedScene: null,
              notes: "",
            },
          },
          core: { sheetClass: "campaign-codex.RegionSheet" },
        },
        pages: [{ name: "Overview", type: "text", text: { content: `<h1>${name}</h1><p>Region overview...</p>` } }],
      };
      return await JournalEntry.create(journalData);
    } finally {
      this._creationQueue.delete(creationKey);
    }
  }

  async createGroupJournal(name = "New Group Overview") {
    const creationKey = `group-${name}`;
    if (this._creationQueue.has(creationKey)) return;
    this._creationQueue.add(creationKey);

    try {
      const journalData = {
        name: name,
        flags: {
          "campaign-codex": {
            type: "group",
            data: {
              description: "",
              members: [],
              notes: "",
            },
          },
          core: { sheetClass: "campaign-codex.GroupSheet" },
        },
        pages: [{ name: "Overview", type: "text", text: { content: `<h1>${name}</h1><p>Group overview...</p>` } }],
      };
      return await JournalEntry.create(journalData);
    } finally {
      this._creationQueue.delete(creationKey);
    }
  }

  // =========================================================================
  // Data Linking & Unlinking
  // =========================================================================

  async linkLocationToNPC(locationDoc, npcDoc) {
    if (locationDoc.uuid === npcDoc.uuid) return;
    // Link NPC to Location
    const locData = locationDoc.getFlag("campaign-codex", "data") || {};
    const locNPCs = new Set(locData.linkedNPCs || []);
    if (!locNPCs.has(npcDoc.uuid)) {
      locNPCs.add(npcDoc.uuid);
      locData.linkedNPCs = [...locNPCs];
      await locationDoc.setFlag("campaign-codex", "data", locData);
    }
    // Link Location to NPC
    const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
    const npcLocs = new Set(npcData.linkedLocations || []);
    if (!npcLocs.has(locationDoc.uuid)) {
      npcLocs.add(locationDoc.uuid);
      npcData.linkedLocations = [...npcLocs];
      await npcDoc.setFlag("campaign-codex", "data", npcData);
    }
  }

  async linkRegionToNPC(regionDoc, npcDoc) {
    if (regionDoc.uuid === npcDoc.uuid) return;
    // Link NPC to Location
    const locData = regionDoc.getFlag("campaign-codex", "data") || {};
    const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
    const locNPCs = new Set(locData.linkedNPCs || []);
    // if (npcData.tagMode){
      if (!locNPCs.has(npcDoc.uuid)) {
        locNPCs.add(npcDoc.uuid);
        locData.linkedNPCs = [...locNPCs];
        await regionDoc.setFlag("campaign-codex", "data", locData);
      }
      // Link Location to NPC
      const npcLocs = new Set(npcData.linkedLocations || []);
      if (!npcLocs.has(regionDoc.uuid)) {
        npcLocs.add(regionDoc.uuid);
        npcData.linkedLocations = [...npcLocs];
        await npcDoc.setFlag("campaign-codex", "data", npcData);
      }
    // } 
  }

  async linkLocationToShop(locationDoc, shopDoc) {
    if (locationDoc.uuid === shopDoc.uuid) return;
    const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
    const oldLocationUuid = shopData.linkedLocation;
    // Unlink from old location if it exists and is different
    if (oldLocationUuid && oldLocationUuid !== locationDoc.uuid) {
      const oldLocationDoc = await fromUuid(oldLocationUuid).catch(() => null);
      if (oldLocationDoc) {
        const oldLocData = oldLocationDoc.getFlag("campaign-codex", "data") || {};
        oldLocData.linkedShops = (oldLocData.linkedShops || []).filter(uuid => uuid !== shopDoc.uuid);
        await oldLocationDoc.setFlag("campaign-codex", "data", oldLocData);
      }
    }
    // Link to new location
    const locData = locationDoc.getFlag("campaign-codex", "data") || {};
    const locShops = new Set(locData.linkedShops || []);
    if (!locShops.has(shopDoc.uuid)) {
      locShops.add(shopDoc.uuid);
      locData.linkedShops = [...locShops];
      await locationDoc.setFlag("campaign-codex", "data", locData);
    }
    // Update shop's location link
    shopData.linkedLocation = locationDoc.uuid;
    await shopDoc.setFlag("campaign-codex", "data", shopData);
  }

  async linkRegionToShop(regionDoc, shopDoc) {
    if (regionDoc.uuid === shopDoc.uuid) return;
    const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
    const oldRegionUuid = shopData.linkedLocation;
    // Unlink from old location if it exists and is different
    if (oldRegionUuid && oldRegionUuid !== regionDoc.uuid) {
      const oldRegionDoc = await fromUuid(oldRegionUuid).catch(() => null);
      if (oldRegionDoc) {
        const oldRegData = oldRegionDoc.getFlag("campaign-codex", "data") || {};
        oldRegData.linkedShops = (oldRegData.linkedShops || []).filter(uuid => uuid !== shopDoc.uuid);
        await oldRegionDoc.setFlag("campaign-codex", "data", oldRegData);
      }
    }
    const regData = regionDoc.getFlag("campaign-codex", "data") || {};
    const regShops = new Set(regData.linkedShops || []);
    if (!regShops.has(shopDoc.uuid)) {
      regShops.add(shopDoc.uuid);
      regData.linkedShops = [...regShops];
      await regionDoc.setFlag("campaign-codex", "data", regData);
    }
    shopData.linkedLocation = regionDoc.uuid;
    await shopDoc.setFlag("campaign-codex", "data", shopData);
  }

  async linkShopToNPC(shopDoc, npcDoc) {
    if (shopDoc.uuid === npcDoc.uuid) return;
    // Link NPC to Shop
    const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
    const shopNPCs = new Set(shopData.linkedNPCs || []);
    if (!shopNPCs.has(npcDoc.uuid)) {
      shopNPCs.add(npcDoc.uuid);
      shopData.linkedNPCs = [...shopNPCs];
      await shopDoc.setFlag("campaign-codex", "data", shopData);
    }
    // Link Shop to NPC
    const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
    const npcShops = new Set(npcData.linkedShops || []);
    if (!npcShops.has(shopDoc.uuid)) {
      npcShops.add(shopDoc.uuid);
      npcData.linkedShops = [...npcShops];
      await npcDoc.setFlag("campaign-codex", "data", npcData);
    }
  }

  async linkNPCToNPC(npc1Doc, npc2Doc) {
    if (npc1Doc.uuid === npc2Doc.uuid) return;
    // Link npc2 to npc1
    const npc1Data = npc1Doc.getFlag("campaign-codex", "data") || {};
    const associates1 = new Set(npc1Data.associates || []);
    if (!associates1.has(npc2Doc.uuid)) {
      associates1.add(npc2Doc.uuid);
      npc1Data.associates = [...associates1];
      await npc1Doc.setFlag("campaign-codex", "data", npc1Data);
    }
    // Link npc1 to npc2
    const npc2Data = npc2Doc.getFlag("campaign-codex", "data") || {};
    const associates2 = new Set(npc2Data.associates || []);
    if (!associates2.has(npc1Doc.uuid)) {
      associates2.add(npc1Doc.uuid);
      npc2Data.associates = [...associates2];
      await npc2Doc.setFlag("campaign-codex", "data", npc2Data);
    }
  }

  async linkRegionToLocation(regionDoc, locationDoc) {
    if (regionDoc.uuid === locationDoc.uuid) return;
    // Unlink location from any other region first
    const allRegions = game.journal.filter(j => j.getFlag("campaign-codex", "type") === "region");
    for (const region of allRegions) {
      if (region.uuid === regionDoc.uuid) continue;
      const regionData = region.getFlag("campaign-codex", "data") || {};
      const linkedLocations = regionData.linkedLocations || [];
      if (linkedLocations.includes(locationDoc.uuid)) {
        regionData.linkedLocations = linkedLocations.filter(uuid => uuid !== locationDoc.uuid);
        await region.setFlag("campaign-codex", "data", regionData);
      }
    }
    // Add location to the new region
    const regionData = regionDoc.getFlag("campaign-codex", "data") || {};
    const linkedLocations = new Set(regionData.linkedLocations || []);
    if (!linkedLocations.has(locationDoc.uuid)) {
      linkedLocations.add(locationDoc.uuid);
      regionData.linkedLocations = [...linkedLocations];
      await regionDoc.setFlag("campaign-codex", "data", regionData);
    }
    // Set the parent region on the location
    const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
    locationData.parentRegion = regionDoc.uuid;
    await locationDoc.setFlag("campaign-codex", "data", locationData);

    for (const app of Object.values(ui.windows)) {
      if (app.document && (app.document.uuid === regionDoc.uuid || app.document.uuid === locationDoc.uuid)) {
        app.render(false);
      }
    }
  }

  async addItemToShop(shopDoc, itemDoc, quantity = 1) {
    const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
    const inventory = shopData.inventory || [];
    const existingItem = inventory.find(i => i.itemUuid === itemDoc.uuid);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      inventory.push({ itemUuid: itemDoc.uuid, quantity: quantity, customPrice: null });
    }
    shopData.inventory = inventory;
    await shopDoc.setFlag("campaign-codex", "data", shopData);
  }

  // =========================================================================
  // Update & Deletion Hooks
  // =========================================================================

  async handleRelationshipUpdates(document, changes, type) {
    if (!foundry.utils.hasProperty(changes, "flags.campaign-codex")) return;
    switch (type) {
      case "location": await this._handleLocationUpdates(document); break;
      case "shop": await this._handleShopUpdates(document); break;
      case "npc": await this._handleNPCUpdates(document, changes.flags["campaign-codex"]?.data || {}); break;
      case "region": await this._handleRegionUpdates(document, changes); break;
      case "group": break;
    }
    await this._scheduleSheetRefresh(document.uuid);
  }

  async cleanupActorRelationships(actorDoc) {
    const npcJournals = game.journal.filter(j => j.getFlag("campaign-codex", "data")?.linkedActor === actorDoc.uuid);
    for (const journal of npcJournals) {
      await journal.unsetFlag("campaign-codex", "data.linkedActor");
    }
  }

  // =========================================================================
  // Internal Update Handlers
  // =========================================================================

  async _handleLocationUpdates(locationDoc) {
    const oldData = foundry.utils.getProperty(locationDoc._source, "flags.campaign-codex.data") || {};
    const newData = foundry.utils.getProperty(locationDoc, "flags.campaign-codex.data") || {};
    // Handle changes in linked shops
    const oldShops = new Set(oldData.linkedShops || []);
    const newShops = new Set(newData.linkedShops || []);
    for (const shopUuid of oldShops) {
      if (!newShops.has(shopUuid)) {
        const shopDoc = await fromUuid(shopUuid).catch(() => null);
        if (shopDoc) await shopDoc.unsetFlag("campaign-codex", "data.linkedLocation");
      }
    }
    for (const shopUuid of newShops) {
      if (!oldShops.has(shopUuid)) {
        const shopDoc = await fromUuid(shopUuid).catch(() => null);
        if (shopDoc) await shopDoc.setFlag("campaign-codex", "data.linkedLocation", locationDoc.uuid);
      }
    }
    // Handle changes in linked NPCs
    const oldNPCs = new Set(oldData.linkedNPCs || []);
    const newNPCs = new Set(newData.linkedNPCs || []);
    for (const npcUuid of oldNPCs) {
      if (!newNPCs.has(npcUuid)) {
        const npcDoc = await fromUuid(npcUuid).catch(() => null);
        if (npcDoc) {
          const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
          npcData.linkedLocations = (npcData.linkedLocations || []).filter(uuid => uuid !== locationDoc.uuid);
          await npcDoc.setFlag("campaign-codex", "data", npcData);
        }
      }
    }
    for (const npcUuid of newNPCs) {
      if (!oldNPCs.has(npcUuid)) {
        const npcDoc = await fromUuid(npcUuid).catch(() => null);
        if (npcDoc) {
          const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
          const locations = new Set(npcData.linkedLocations || []);
          locations.add(locationDoc.uuid);
          npcData.linkedLocations = [...locations];
          await npcDoc.setFlag("campaign-codex", "data", npcData);
        }
      }
    }
  }

  async _handleShopUpdates(shopDoc) {
    const oldData = foundry.utils.getProperty(shopDoc._source, "flags.campaign-codex.data") || {};
    const newData = foundry.utils.getProperty(shopDoc, "flags.campaign-codex.data") || {};
    // Handle change in parent location
    const oldLocationUuid = oldData.linkedLocation;
    const newLocationUuid = newData.linkedLocation;
    if (oldLocationUuid !== newLocationUuid) {
      if (oldLocationUuid) {
        const oldLocationDoc = await fromUuid(oldLocationUuid).catch(() => null);
        if (oldLocationDoc) {
          const data = oldLocationDoc.getFlag("campaign-codex", "data") || {};
          data.linkedShops = (data.linkedShops || []).filter(uuid => uuid !== shopDoc.uuid);
          await oldLocationDoc.setFlag("campaign-codex", "data", data);
        }
      }
      if (newLocationUuid) {
        const newLocationDoc = await fromUuid(newLocationUuid).catch(() => null);
        if (newLocationDoc) {
          const data = newLocationDoc.getFlag("campaign-codex", "data") || {};
          const shops = new Set(data.linkedShops || []);
          shops.add(shopDoc.uuid);
          data.linkedShops = [...shops];
          await newLocationDoc.setFlag("campaign-codex", "data", data);
        }
      }
    }
    // Handle changes in linked NPCs
    const oldNPCs = new Set(oldData.linkedNPCs || []);
    const newNPCs = new Set(newData.linkedNPCs || []);
    for (const npcUuid of oldNPCs) {
      if (!newNPCs.has(npcUuid)) {
        const npcDoc = await fromUuid(npcUuid).catch(() => null);
        if (npcDoc) {
          const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
          npcData.linkedShops = (npcData.linkedShops || []).filter(uuid => uuid !== shopDoc.uuid);
          await npcDoc.setFlag("campaign-codex", "data", npcData);
        }
      }
    }
    for (const npcUuid of newNPCs) {
      if (!oldNPCs.has(npcUuid)) {
        const npcDoc = await fromUuid(npcUuid).catch(() => null);
        if (npcDoc) {
          const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
          const shops = new Set(npcData.linkedShops || []);
          shops.add(shopDoc.uuid);
          npcData.linkedShops = [...shops];
          await npcDoc.setFlag("campaign-codex", "data", npcData);
        }
      }
    }
  }

  async _handleNPCUpdates(npcDoc, changes) {
    const oldData = foundry.utils.getProperty(npcDoc._source, "flags.campaign-codex.data") || {};
    const newData = foundry.utils.getProperty(npcDoc, "flags.campaign-codex.data") || {};
    const updateTasks = [];
    // Handle changes in linked locations
    if (changes.linkedLocations) {
      const oldLocations = new Set(oldData.linkedLocations || []);
      const newLocations = new Set(newData.linkedLocations || []);
      for (const locUuid of oldLocations) {
        if (!newLocations.has(locUuid)) {
          updateTasks.push(this._updateLinkedDoc(locUuid, "linkedNPCs", npcDoc.uuid, "remove"));
        }
      }
      for (const locUuid of newLocations) {
        if (!oldLocations.has(locUuid)) {
          updateTasks.push(this._updateLinkedDoc(locUuid, "linkedNPCs", npcDoc.uuid, "add"));
        }
      }
    }
    // Handle changes in linked shops
    if (changes.linkedShops) {
      const oldShops = new Set(oldData.linkedShops || []);
      const newShops = new Set(newData.linkedShops || []);
      for (const shopUuid of oldShops) {
        if (!newShops.has(shopUuid)) {
          updateTasks.push(this._updateLinkedDoc(shopUuid, "linkedNPCs", npcDoc.uuid, "remove"));
        }
      }
      for (const shopUuid of newShops) {
        if (!oldShops.has(shopUuid)) {
          updateTasks.push(this._updateLinkedDoc(shopUuid, "linkedNPCs", npcDoc.uuid, "add"));
        }
      }
    }
    // Handle changes in associates
    if (changes.associates) {
      const oldAssociates = new Set(oldData.associates || []);
      const newAssociates = new Set(newData.associates || []);
      for (const assocUuid of oldAssociates) {
        if (!newAssociates.has(assocUuid)) {
          updateTasks.push(this._updateLinkedDoc(assocUuid, "associates", npcDoc.uuid, "remove"));
        }
      }
      for (const assocUuid of newAssociates) {
        if (!oldAssociates.has(assocUuid)) {
          updateTasks.push(this._updateLinkedDoc(assocUuid, "associates", npcDoc.uuid, "add"));
        }
      }
    }
    await Promise.all(updateTasks);
  }

  async _handleRegionUpdates(regionDoc, changes) {
    if (!foundry.utils.hasProperty(changes, "flags.campaign-codex.data.linkedLocations")) return;
    const oldData = foundry.utils.getProperty(regionDoc._source, "flags.campaign-codex.data") || {};
    const newData = foundry.utils.getProperty(regionDoc, "flags.campaign-codex.data") || {};
    const oldLocations = new Set(oldData.linkedLocations || []);
    const newLocations = new Set(newData.linkedLocations || []);
    for (const locUuid of oldLocations) {
      if (!newLocations.has(locUuid)) {
        const locDoc = await fromUuid(locUuid).catch(() => null);
        if (locDoc) await locDoc.unsetFlag("campaign-codex", "data.parentRegion");
      }
    }
    for (const locUuid of newLocations) {
      if (!oldLocations.has(locUuid)) {
        const locDoc = await fromUuid(locUuid).catch(() => null);
        if (locDoc) await locDoc.setFlag("campaign-codex", "data.parentRegion", regionDoc.uuid);
      }
    }
    // Handle changes in linked shops
    const oldShops = new Set(oldData.linkedShops || []);
    const newShops = new Set(newData.linkedShops || []);
    for (const shopUuid of oldShops) {
      if (!newShops.has(shopUuid)) {
        const shopDoc = await fromUuid(shopUuid).catch(() => null);
        if (shopDoc) await shopDoc.unsetFlag("campaign-codex", "data.linkedLocation");
      }
    }
    for (const shopUuid of newShops) {
      if (!oldShops.has(shopUuid)) {
        const shopDoc = await fromUuid(shopUuid).catch(() => null);
        if (shopDoc) await shopDoc.setFlag("campaign-codex", "data.linkedLocation", locationDoc.uuid);
      }
    }
        // Handle changes in linked NPCs
    const oldNPCs = new Set(oldData.linkedNPCs || []);
    const newNPCs = new Set(newData.linkedNPCs || []);
    for (const npcUuid of oldNPCs) {
      if (!newNPCs.has(npcUuid)) {
        const npcDoc = await fromUuid(npcUuid).catch(() => null);
        if (npcDoc) {
          const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
          npcData.linkedShops = (npcData.linkedShops || []).filter(uuid => uuid !== shopDoc.uuid);
          await npcDoc.setFlag("campaign-codex", "data", npcData);
        }
      }
    }
    for (const npcUuid of newNPCs) {
      if (!oldNPCs.has(npcUuid)) {
        const npcDoc = await fromUuid(npcUuid).catch(() => null);
        if (npcDoc) {
          const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
          const shops = new Set(npcData.linkedShops || []);
          shops.add(shopDoc.uuid);
          npcData.linkedShops = [...shops];
          await npcDoc.setFlag("campaign-codex", "data", npcData);
        }
      }
    }
  }

  // =========================================================================
  // UI & Sheet Management
  // =========================================================================


async _scheduleSheetRefresh(changedDocUuid) {
    const sheetsToRefresh = new Set();
    const docsWithOpenEditors = new Set();
    
    for (const app of Object.values(ui.windows)) {
      if (app.constructor.name === "DescriptionEditor" && app.document) {
        docsWithOpenEditors.add(app.document.uuid);
      }
    }

    const indirectlyRelatedUuids = new Set();
    try {
      const changedDoc = await fromUuid(changedDocUuid);
      if (changedDoc) {
        const changedType = changedDoc.getFlag("campaign-codex", "type");

        // Case 1: An NPC was updated
        if (changedType === "npc") {
          const npcData = changedDoc.getFlag("campaign-codex", "data") || {};
          const directLocationsAndRegions = (await CampaignCodexLinkers.getNameFromUuids(npcData.linkedLocations || [])).map(uuid => fromUuid(uuid));
          const allLocations = await CampaignCodexLinkers.getAllLocations(changedDoc, npcData.linkedLocations || []);
          const allRelatedLocations = [...allLocations];

          (await Promise.all(directLocationsAndRegions)).forEach(doc => {
              if (doc) allRelatedLocations.push({uuid: doc.uuid});
          });

          allRelatedLocations.forEach(loc => indirectlyRelatedUuids.add(loc.uuid));

          const regionPromises = allRelatedLocations.map(async (loc) => {
            try {
              const locationDoc = await fromUuid(loc.uuid);
              return locationDoc ? locationDoc.getFlag("campaign-codex", "data.parentRegion") : null;
            } catch {
              return null;
            }
          });
          const regionUuids = await Promise.all(regionPromises);
          regionUuids.forEach(uuid => {
            if (uuid) indirectlyRelatedUuids.add(uuid);
          });
        }
        
        if(changedType === "shop") {
            const shopData = changedDoc.getFlag("campaign-codex", "data") || {};
            if(shopData.linkedLocation) {
                indirectlyRelatedUuids.add(shopData.linkedLocation);
                const locationDoc = await fromUuid(shopData.linkedLocation);
                if(locationDoc) {
                    const parentRegion = locationDoc.getFlag("campaign-codex", "data.parentRegion");
                    if(parentRegion) indirectlyRelatedUuids.add(parentRegion);
                }
            }
        }
        
        // if(changedType === "location") {
        //      const locationData = changedDoc.getFlag("campaign-codex", "data") || {};
        //      if(locationData.parentRegion) {
        //          indirectlyRelatedUuids.add(locationData.parentRegion);
        //      }
        // }
      }
    } catch (e) {
      console.warn(`Campaign Codex | Could not process indirect relationships for ${changedDocUuid}`, e);
    }

    for (const app of Object.values(ui.windows)) {
      if (!app.document?.getFlag) continue;
      if (docsWithOpenEditors.has(app.document.uuid)) {
        console.log(`Campaign Codex | Skipping refresh for ${app.document.name} because it has an open editor.`);
        continue;
      }
      
      if (app.document.uuid === changedDocUuid) {
        sheetsToRefresh.add(app);
        continue;
      }

      if (indirectlyRelatedUuids.has(app.document.uuid)) {
        sheetsToRefresh.add(app);
        continue;
      }

      if (app._isRelatedDocument && (await app._isRelatedDocument(changedDocUuid))) {
        sheetsToRefresh.add(app);
      }
    }

    for (const app of sheetsToRefresh) {
      app.render(false);
    }
  }

  // =========================================================================
  // Scene Management
  // =========================================================================

  async linkSceneToDocument(scene, document) {
    if (!scene || !document) return;
    let targetScene = scene;
    if (scene.pack) {
      const existingScene = game.scenes.find(s => s.name === scene.name);
      if (existingScene) {
        targetScene = existingScene;
        ui.notifications.info(`Using existing scene "${scene.name}" from world`);
      } else {
        try {
          const importedScenes = await Scene.createDocuments([scene.toObject()]);
          targetScene = importedScenes[0];
          ui.notifications.info(`Imported scene "${scene.name}" from compendium to world`);
        } catch (error) {
          ui.notifications.error(`Failed to import scene "${scene.name}": ${error.message}`);
          console.error("Campaign Codex | Failed to import scene:", error);
          return;
        }
      }
    }
    const docData = document.getFlag("campaign-codex", "data") || {};
    docData.linkedScene = targetScene.uuid;
    await document.setFlag("campaign-codex", "data", docData);
  }

  async openLinkedScene(document) {
    const documentData = document.getFlag("campaign-codex", "data") || {};
    const linkedSceneUuid = documentData.linkedScene;
    if (!linkedSceneUuid) return ui.notifications.warn("No scene linked to this document");

    try {
      const linkedScene = await fromUuid(linkedSceneUuid);
      if (!linkedScene) return ui.notifications.error("Linked scene not found");
      if (!linkedScene.pack) return linkedScene.view();
      
      const worldSceneUuid = documentData.worldSceneUuid;
      if (worldSceneUuid) {
        try {
          const worldScene = await fromUuid(worldSceneUuid);
          if (worldScene && !worldScene.pack) return worldScene.view();
        } catch (error) {
          console.warn("Campaign Codex | World scene UUID invalid, re-importing", error);
        }
      }
      await this._importSceneAndSetWorldUuid(document, linkedScene, documentData);
    } catch (error) {
      console.error("Campaign Codex | Error opening linked scene:", error);
      ui.notifications.error("Failed to open linked scene");
    }
  }

  async _importSceneAndSetWorldUuid(document, compendiumScene, documentData) {
    try {
      const existingScene = game.scenes.find(s => s.name === compendiumScene.name);
      let worldScene;
      if (existingScene) {
        worldScene = existingScene;
        ui.notifications.info(`Using existing world scene "${compendiumScene.name}"`);
      } else {
        const importedScenes = await Scene.createDocuments([compendiumScene.toObject()]);
        worldScene = importedScenes[0];
        ui.notifications.info(`Imported scene "${compendiumScene.name}" from compendium to world`);
      }
      await document.setFlag("campaign-codex", "data.worldSceneUuid", worldScene.uuid);
      worldScene.view();
    } catch (error) {
      console.error("Campaign Codex | Error importing scene:", error);
      ui.notifications.error(`Failed to import scene "${compendiumScene.name}": ${error.message}`);
    }
  }

  // =========================================================================
  // Getters & Utility Methods
  // =========================================================================

  getActorDisplayMeta(actor, tag) {
    if (tag) return `<span class="entity-type" style="background: var(--cc-border);">${localize("names.tag")}</span>`;
    if (!actor) return `<span class="entity-type">${localize('names.npc')}</span>`;
    if (actor.type === "character") return `<span class="entity-type-player">${localize('names.player')}</span>`;
    return `<span class="entity-type">${localize('names.npc')}</span>`;
  }

  async findOrCreateNPCJournalForActor(actor) {
    if (!actor) return null;
    let npcJournal = game.journal.find(j => 
      j.getFlag("campaign-codex", "type") === "npc" &&
      j.getFlag("campaign-codex", "data")?.linkedActor === actor.uuid
    );
    if (!npcJournal) {
      npcJournal = await this.createNPCJournal(actor);
      ui.notifications.info(`Created NPC journal for "${actor.name}"`);
    }
    return npcJournal;
  }

  async getLinkedDocuments(sourceDoc, linkType) {
    const data = sourceDoc.getFlag("campaign-codex", "data") || {};
    const linkedIds = data[linkType] || [];
    if (linkType === "linkedActor") {
      if (!linkedIds) return [];
      const actor = await fromUuid(linkedIds);
      return actor ? [actor] : [];
    }
    const documents = [];
    for (const uuid of Array.isArray(linkedIds) ? linkedIds : [linkedIds]) {
      if (uuid) {
        const doc = await fromUuid(uuid);
        if (doc) documents.push(doc);
      }
    }
    return documents;
  }


  async resetItemPathsToDefaults() {
    try {
      await game.settings.set("campaign-codex", "itemPricePath", "system.price.value");
      await game.settings.set("campaign-codex", "itemDenominationPath", "system.price.denomination");
      ui.notifications.info("Item price paths reset to D&D5e defaults");
    } catch (error) {
      console.error("Campaign Codex | Error resetting item paths:", error);
      ui.notifications.error("Failed to reset item paths");
    }
  }

  async _updateLinkedDoc(docUuid, field, value, action = "add") {
    const doc = await fromUuid(docUuid).catch(() => null);
    if (doc) {
      const data = doc.getFlag("campaign-codex", "data") || {};
      const links = new Set(data[field] || []);
      if (action === "add") links.add(value);
      else links.delete(value);
      data[field] = [...links];
      return doc.setFlag("campaign-codex", "data", data);
    }
  }
}