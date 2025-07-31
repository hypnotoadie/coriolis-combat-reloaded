// Coriolis Combat Reloaded - main.js (Updated for Foundry v13)

// Constants
const MODULE_ID = "coriolis-combat-reloaded";

// Register module settings
Hooks.once("init", () => {
  console.log("Coriolis Combat Reloaded | Initializing");
  
  // Register module settings
  game.settings.register(MODULE_ID, "enableCombatReloaded", {
    name: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.name"),
    hint: game.i18n.localize("coriolis-combat-reloaded.settings.enableCombatReloaded.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: _ => window.location.reload()
  });
});

// This is our main hook for implementing changes
Hooks.once("ready", function() {
  // Make sure Combat Reloaded is enabled
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  console.log("Coriolis Combat Reloaded | Module Ready");
  
  // Initialize the module
  initializeItemFields();
  setupChatObserver();
  ui.notifications.info(game.i18n.localize("coriolis-combat-reloaded.messages.moduleActive"));
});

// Initialize item fields for existing items
function initializeItemFields() {
  // Add armorPenetration to weapons that don't have it
  game.items.filter(i => i.type === "weapon").forEach(item => {
    if (item.system.armorPenetration === undefined) {
      console.log(`Initializing AP field for weapon ${item.name}`);
      item.update({"system.armorPenetration": 0});
    }
  });
  
  // Add damageReduction to armor that don't have it
  game.items.filter(i => i.type === "armor").forEach(item => {
    if (item.system.damageReduction === undefined) {
      const arValue = item.system.armorRating || 0;
      console.log(`Initializing DR field for armor ${item.name} with value ${arValue}`);
      item.update({"system.damageReduction": arValue});
    }
  });
}

// Setup Observer for Chat Messages - Updated for v13
function setupChatObserver() {
  // Use native DOM methods instead of jQuery for better v13 compatibility
  const chatLog = document.getElementById("chat-log");
  if (chatLog) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && 
                node.classList.contains('message') && 
                node.dataset.messageId) {
              
              // Process the new chat message
              processNewChatMessage(node);
            }
          });
        }
      });
    });
    
    // Start observing
    observer.observe(chatLog, { childList: true, subtree: false });
    console.log("Added observer for chat messages");
  }
}

// Process a new chat message - Updated for v13
function processNewChatMessage(messageNode) {
  // Get the message ID
  const messageId = messageNode.dataset.messageId;
  const message = game.messages.get(messageId);
  
  // Skip if not a valid message
  if (!message) return;
  
  // Check if it's a weapon roll using native DOM methods where possible
  const hasRoll = messageNode.querySelector('.dice-roll') !== null;
  const isWeaponRoll = hasRoll && (
    messageNode.textContent.includes("Weapon") ||
    message.flags?.yzecoriolis?.results?.rollData?.rollType === "weapon"
  );
  
  if (isWeaponRoll) {
    addAPToWeaponRoll(messageNode, message);
  }
  
  // Also check for item cards
  const itemCard = messageNode.querySelector(".item-card");
  if (itemCard) {
    processItemCard(itemCard, messageNode);
  }
}

// Add AP to weapon roll - Refactored for better DOM handling
function addAPToWeaponRoll(messageNode, message) {
  let apValue = 0;
  
  // Try to get from actor
  if (message.speaker.actor) {
    const actor = game.actors.get(message.speaker.actor);
    if (actor) {
      let weaponName = "";
      
      // Try from roll data
      if (message.flags?.yzecoriolis?.results?.rollData?.rollTitle) {
        weaponName = message.flags.yzecoriolis.results.rollData.rollTitle;
      }
      
      // Try from message content using native DOM
      if (!weaponName) {
        const titleElement = messageNode.querySelector('h2.roll-name');
        if (titleElement) {
          weaponName = titleElement.textContent.split('\n')[0].trim();
        }
      }
      
      // Find the weapon
      if (weaponName) {
        const weapon = actor.items.find(i => 
          i.type === "weapon" && 
          i.name === weaponName
        );
        
        if (weapon && weapon.system.armorPenetration !== undefined) {
          apValue = weapon.system.armorPenetration;
          console.log(`Found AP ${apValue} for weapon ${weaponName}`);
        }
      }
    }
  }
  
  // Find damage row and add AP
  const damageRow = messageNode.querySelector('tr td:first-child');
  if (damageRow && damageRow.textContent.includes("Damage:") && 
      !messageNode.querySelector('.ap-value')) {
    
    // Create AP row
    const apRow = document.createElement('tr');
    apRow.innerHTML = `
      <td>AP:</td>
      <td><span class="ap-value">${apValue}</span></td>
    `;
    
    // Insert after damage row
    damageRow.closest('tr').insertAdjacentElement('afterend', apRow);
  }
}

// Process item card - Updated for v13
function processItemCard(itemCard, messageNode) {
  const itemId = itemCard.dataset.itemId;
  const actorId = itemCard.dataset.actorId;
  
  if (itemId && actorId) {
    const actor = game.actors.get(actorId);
    if (actor) {
      const item = actor.items.get(itemId);
      if (item) {
        if (item.type === "weapon") {
          addAPToWeaponItemCard(item, messageNode);
        } else if (item.type === "armor") {
          replaceDROnArmorItemCard(item, messageNode);
        }
      }
    }
  }
}

// Hook into item sheet rendering - Updated hook name for v13 compatibility
Hooks.on("renderItemSheet", (app, html, data) => {
  // Check if this is a yzecoriolis item sheet
  if (!app.constructor.name.includes("yzecoriolis") || 
      !game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // If this is a weapon sheet, add AP field
  if (app.item.type === "weapon") {
    addAPFieldToWeaponSheet(app, html, data);
  }
  
  // If this is an armor sheet, replace AR with DR
  if (app.item.type === "armor") {
    replaceARWithDROnArmorSheet(app, html, data);
  }
});

// Add AP field to weapon sheet - Updated for better DOM handling
function addAPFieldToWeaponSheet(app, html, data) {
  // Convert jQuery object to DOM element if needed
  const htmlElement = html[0] || html;
  
  // Check if already processed
  if (htmlElement.dataset.apProcessed) {
    console.log("AP field already processed, skipping");
    return;
  }
  
  // Mark as processed
  htmlElement.dataset.apProcessed = "true";
  
  // Get current AP value
  let apValue = app.item.system.armorPenetration;
  if (apValue === undefined || apValue === null || isNaN(apValue)) {
    apValue = 0;
    app.item.update({"system.armorPenetration": 0});
  }
  
  // Find insertion point using native DOM where possible
  const damageLabel = Array.from(htmlElement.querySelectorAll('.resource-label'))
    .find(label => label.textContent.includes("Damage"));
  const damageField = damageLabel?.closest('.resource');
  
  if (damageField) {
    // Create AP field
    const apFieldHTML = `
      <div class="resource numeric-input flexrow ap-field" id="ap-field-${app.item.id}">
        <label class="resource-label">${game.i18n.localize("coriolis-combat-reloaded.labels.armorPenetration")}</label>
        <input type="number" name="system.armorPenetration" value="${apValue}" data-dtype="Number">
      </div>
    `;
    
    // Insert after damage field
    damageField.insertAdjacentHTML('afterend', apFieldHTML);
    
    // Add event handler
    const apInput = htmlElement.querySelector(`#ap-field-${app.item.id} input`);
    if (apInput) {
      apInput.addEventListener('change', function() {
        const val = Number(this.value) || 0;
        app.item.update({"system.armorPenetration": val});
        console.log(`Updated AP value to ${val} for item ${app.item.name}`);
      });
    }
  }
}

// Replace AR with DR on armor sheet - Updated for v13
function replaceARWithDROnArmorSheet(app, html, data) {
  const htmlElement = html[0] || html;
  
  if (htmlElement.dataset.drProcessed) {
    return;
  }
  
  htmlElement.dataset.drProcessed = "true";
  
  const armorRating = app.item.system.armorRating || 0;
  let damageReduction = app.item.system.damageReduction;
  
  if (damageReduction === undefined || damageReduction === null || isNaN(damageReduction)) {
    damageReduction = armorRating;
    app.item.update({"system.damageReduction": armorRating});
  }
  
  // Find armor rating field
  const arLabel = Array.from(htmlElement.querySelectorAll('.resource-label'))
    .find(label => label.textContent.includes("Armor Rating"));
  const arField = arLabel?.closest('.resource');
  
  if (arField) {
    // Update label
    arLabel.textContent = game.i18n.localize("coriolis-combat-reloaded.labels.damageReduction");
    
    // Update input
    const arInput = arField.querySelector('input');
    if (arInput) {
      const originalName = arInput.name;
      
      // Create hidden input for original field
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = originalName;
      hiddenInput.value = armorRating;
      arField.appendChild(hiddenInput);
      
      // Update visible input
      arInput.name = 'system.damageReduction';
      arInput.value = damageReduction;
      
      arInput.addEventListener('change', function() {
        const val = Number(this.value) || 0;
        app.item.update({
          "system.damageReduction": val,
          "system.armorRating": val
        });
        hiddenInput.value = val;
      });
    }
  }
}

// Add AP to weapon item card - Updated for v13
function addAPToWeaponItemCard(weapon, messageNode) {
  if (messageNode.querySelector('.card-ap')) return;
  
  const apValue = weapon.system.armorPenetration || 0;
  const damageElement = messageNode.querySelector(".card-damage");
  
  if (damageElement) {
    const apElement = document.createElement('div');
    apElement.className = 'card-ap';
    apElement.innerHTML = `
      <span class="label">${game.i18n.localize("coriolis-combat-reloaded.labels.ap")}:</span>
      <span class="value">${apValue}</span>
    `;
    
    damageElement.insertAdjacentElement('afterend', apElement);
  }
}

// Replace AR with DR on armor item card - Updated for v13
function replaceDROnArmorItemCard(armor, messageNode) {
  if (messageNode.querySelector('.card-damage-reduction')) return;
  
  const armorRating = armor.system.armorRating || 0;
  const damageReduction = armor.system.damageReduction !== undefined ? 
                         armor.system.damageReduction : armorRating;
  
  const arElement = messageNode.querySelector(".card-armor-rating");
  
  if (arElement) {
    const labelElement = arElement.querySelector(".label");
    const valueElement = arElement.querySelector(".value");
    
    if (labelElement) labelElement.textContent = game.i18n.localize("coriolis-combat-reloaded.labels.dr") + ":";
    if (valueElement) valueElement.textContent = damageReduction;
    
    arElement.classList.remove("card-armor-rating");
    arElement.classList.add("card-damage-reduction");
  }
}

// Handle chat message rendering - Updated for v13
Hooks.on("renderChatMessage", (message, html, data) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  // html is now consistently a jQuery object in v13, but we convert to DOM element
  const htmlElement = html[0] || html;
  processNewChatMessage(htmlElement);
});

// Handle item creation - Updated for v13
Hooks.on("createItem", (item, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  if (game.user.id !== userId) return;
  
  if (item.type === "weapon" && item.system.armorPenetration === undefined) {
    item.update({"system.armorPenetration": 0});
  }
  
  if (item.type === "armor" && item.system.damageReduction === undefined) {
    const armorRating = item.system.armorRating || 0;
    item.update({"system.damageReduction": armorRating});
  }
});

// Handle pre-creation - Updated for v13
Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (!game.settings.get(MODULE_ID, "enableCombatReloaded")) return;
  
  if (data.type === "weapon" && !data.system?.armorPenetration) {
    item.updateSource({"system.armorPenetration": 0});
  }
  
  if (data.type === "armor" && !data.system?.damageReduction) {
    const armorRating = data.system?.armorRating || 0;
    item.updateSource({"system.damageReduction": armorRating});
  }
});