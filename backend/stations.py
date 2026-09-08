"""Which station prepares a menu item — powers the barista vs kitchen sales split.

Each menu item carries an explicit ``station`` field that the owner sets in the
Menu page. The category map below is only a *default*: it backfills existing
items and fills in when an item has no explicit station yet.
"""

BARISTA = "barista"
KITCHEN = "kitchen"
UNASSIGNED = "unassigned"

STATIONS = (BARISTA, KITCHEN)

STATION_LABELS = {
    BARISTA: "Barista",
    KITCHEN: "Kitchen",
    UNASSIGNED: "Unassigned",
}

# Default station per menu category. "Signatures" is mixed in practice, so it
# starts as barista and the owner reassigns individual food items in the Menu page.
CATEGORY_STATION = {
    # Drinks / counter — barista
    "Hot Beverages": BARISTA,
    "Cold Beverages": BARISTA,
    "House Speciality Coffees": BARISTA,
    "Tea Treasures": BARISTA,
    "Mojitos": BARISTA,
    "Milkshakes": BARISTA,
    "Frappes": BARISTA,
    "Signatures": BARISTA,
    "Desserts": BARISTA,
    "Add-ons": BARISTA,
    # Food — kitchen
    "Soup": KITCHEN,
    "Salad": KITCHEN,
    "Small Plates": KITCHEN,
    "Burger and Sandwiches": KITCHEN,
    "Gourmet Wraps": KITCHEN,
    "All Day Breakfast": KITCHEN,
    "Mains": KITCHEN,
}


def station_for_category(category) -> str:
    """Default station for a category; UNASSIGNED for categories we don't know."""
    return CATEGORY_STATION.get((category or "").strip(), UNASSIGNED)


def normalize_station(value, category) -> str:
    """Coerce user input to a valid station, falling back to the category default."""
    s = (value or "").strip().lower()
    return s if s in STATIONS else station_for_category(category)


def resolve_station(menu_doc: dict) -> str:
    """Station for a menu doc — explicit field wins, else the category default."""
    if not menu_doc:
        return UNASSIGNED
    s = (menu_doc.get("station") or "").strip().lower()
    return s if s in STATIONS else station_for_category(menu_doc.get("category"))
