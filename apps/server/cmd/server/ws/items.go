package ws

import "time"

// EffectType classifies what an item does mechanically.
type EffectType string

const (
	EffectSpeedBoost  EffectType = "speed_boost"
	EffectSlow        EffectType = "slow"
	EffectShield      EffectType = "shield"
	EffectTeleport    EffectType = "teleport"
)

// ItemDef defines a single item in the game.
type ItemDef struct {
	ID          ItemType   `json:"id"`
	Name        string     `json:"name"`
	Icon        string     `json:"icon"`
	Description string     `json:"description"`
	Duration    int        `json:"duration"`   // seconds; 0 = instant
	EffectType  EffectType `json:"effectType"`
	EffectValue int        `json:"effectValue"` // magnitude (teleport steps, speed multiplier-1, etc.)
}

// EffectHandler processes an item's effect on the room.
type EffectHandler func(room *Room, userID, targetID int, def ItemDef)

var (
	itemRegistry    = make(map[ItemType]ItemDef)
	effectHandlers  = make(map[EffectType]EffectHandler)
)

func init() {
	registerItem(ItemDef{
		ID:          ItemSpeedBoost,
		Name:        "Speed Boost",
		Icon:        "🚀",
		Description: "Double your movement speed",
		Duration:    5,
		EffectType:  EffectSpeedBoost,
		EffectValue: 2,
	})
	registerItem(ItemDef{
		ID:          ItemSlowTrap,
		Name:        "Slow Trap",
		Icon:        "🧲",
		Description: "Slow the opponent for a few seconds",
		Duration:    4,
		EffectType:  EffectSlow,
		EffectValue: 1,
	})
	registerItem(ItemDef{
		ID:          ItemShield,
		Name:        "Shield",
		Icon:        "🛡️",
		Description: "Block the next debuff against you",
		Duration:    0,
		EffectType:  EffectShield,
		EffectValue: 0,
	})
	registerItem(ItemDef{
		ID:          ItemTeleport,
		Name:        "Teleport",
		Icon:        "⚡",
		Description: "Instantly jump forward",
		Duration:    0,
		EffectType:  EffectTeleport,
		EffectValue: 8,
	})

	effectHandlers[EffectSpeedBoost] = handleSpeedBoost
	effectHandlers[EffectSlow] = handleSlowTrap
	effectHandlers[EffectShield] = handleShield
	effectHandlers[EffectTeleport] = handleTeleport
}

// RegisterItem adds or replaces an item definition and its handler.
func RegisterItem(def ItemDef, handler EffectHandler) {
	itemRegistry[def.ID] = def
	if handler != nil {
		effectHandlers[def.EffectType] = handler
	}
}

// GetItemDef returns the definition for a given item type.
func GetItemDef(id ItemType) (ItemDef, bool) {
	def, ok := itemRegistry[id]
	return def, ok
}

// GetAllItemDefs returns all registered item definitions.
func GetAllItemDefs() []ItemDef {
	defs := make([]ItemDef, 0, len(itemRegistry))
	for _, def := range itemRegistry {
		defs = append(defs, def)
	}
	return defs
}

func registerItem(def ItemDef) {
	itemRegistry[def.ID] = def
}

// GetOpponentID returns the opponent's user ID in chase mode.
func getOpponentID(room *Room, userID int) int {
	p, ok := room.Players[userID]
	if !ok {
		return 0
	}
	if p.Role == "cop" {
		return room.chaseRobberID
	}
	return room.chaseCopID
}

func handleSpeedBoost(room *Room, userID, targetID int, def ItemDef) {
	p := room.Players[userID]
	p.SpeedBoostEnd = time.Now().Add(time.Duration(def.Duration) * time.Second)
	room.Players[userID] = p
	room.broadcastItemUse(userID, userID, def.ID, "self")
}

func handleSlowTrap(room *Room, userID, targetID int, def ItemDef) {
	opp := room.Players[targetID]
	if opp.HasShield {
		opp.HasShield = false
		room.Players[targetID] = opp
		room.broadcastItemUse(userID, targetID, ItemSlowTrap, "blocked")
		return
	}
	opp.SlowEnd = time.Now().Add(time.Duration(def.Duration) * time.Second)
	room.Players[targetID] = opp
	room.broadcastItemUse(userID, targetID, def.ID, "opponent")
}

func handleShield(room *Room, userID, targetID int, def ItemDef) {
	p := room.Players[userID]
	p.HasShield = true
	room.Players[userID] = p
	room.broadcastItemUse(userID, userID, def.ID, "self")
}

func handleTeleport(room *Room, userID, targetID int, def ItemDef) {
	p := room.Players[userID]
	newPos := p.Progress + def.EffectValue
	if newPos > room.chaseMapLen {
		newPos = room.chaseMapLen
	}
	p.Progress = newPos
	room.Players[userID] = p
	room.Broadcast(MsgItemUse, map[string]interface{}{
		"userId":  userID,
		"item":    def.ID,
		"effect":  "teleport",
		"newPos":  newPos,
	})
}

func (r *Room) broadcastItemUse(userID, targetID int, item ItemType, effect string) {
	payload := map[string]interface{}{
		"userId":   userID,
		"targetId": targetID,
		"item":     item,
		"effect":   effect,
	}
	if def, ok := GetItemDef(item); ok && def.Duration > 0 {
		payload["duration"] = def.Duration
	}
	// For hidden effects, don't reveal who used the item
	if effect == "opponent" || effect == "blocked" {
		clean := map[string]interface{}{
			"targetId": targetID,
			"item":     item,
			"effect":   effect,
		}
		if d, ok := payload["duration"]; ok {
			clean["duration"] = d
		}
		r.broadcastExcept(userID, MsgItemUse, clean)
		r.Players[userID].Client.Send(MsgItemUse, map[string]interface{}{
			"userId":   userID,
			"targetId": targetID,
			"item":     item,
			"effect":   "self",
			"duration": payload["duration"],
		})
		return
	}
	r.Broadcast(MsgItemUse, payload)
}
